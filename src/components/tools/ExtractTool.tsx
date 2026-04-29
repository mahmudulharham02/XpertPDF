import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileText, Loader2, CheckCircle2, ChevronRight, Languages } from 'lucide-react';
import { copyToClipboard } from '../../lib/utils';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const getTesseractLang = (lang: string) => {
  switch(lang) {
    case 'Spanish': return 'spa';
    case 'French': return 'fra';
    case 'German': return 'deu';
    case 'Japanese': return 'jpn';
    case 'Korean': return 'kor';
    case 'Arabic': return 'ara';
    default: return 'eng'; // Also fallback for auto
  }
};

export function ExtractTool() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState<string>('');
  const [language, setLanguage] = useState<string>('auto');
  const [copied, setCopied] = useState(false);
  
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setExtractedText('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    },
    maxFiles: 1
  } as any);

  const extractPdfText = async (fileToProcess: File) => {
    const arrayBuffer = await fileToProcess.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n\n';
    }
    
    // If native extraction yielded very little text, 
    // it's likely a scanned PDF. For a full app we'd OCR every page canvas.
    // Here we'll show what we found.
    return fullText.trim() || 'No native text found (scanned PDF image). For full scanned PDF OCR, convert pages to images first.';
  };

  const handleExtract = async () => {
    if (!file) return;
    
    setIsProcessing(true);
    setExtractedText('');
    
    try {
      let resultText = '';
      if (file.type === 'application/pdf') {
        resultText = await extractPdfText(file);
      } else {
        const tessLang = getTesseractLang(language);
        const result = await Tesseract.recognize(file, tessLang);
        resultText = result.data.text;
      }
      
      setExtractedText(resultText || 'No text could be extracted.');
    } catch (error) {
      console.error(error);
      setExtractedText(`Error extracting text: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col lg:flex-row">
        
        {/* Left Side: Upload & Controls */}
        <div className="w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50/50 p-6 flex flex-col gap-6">
          <div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">Source Document</h3>
            <p className="text-sm text-slate-500">Upload a PDF or Image</p>
          </div>

          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-slate-400 bg-white'
            }`}
          >
            <input {...getInputProps()} />
            <UploadCloud className={`w-10 h-10 mb-3 ${isDragActive ? 'text-indigo-500' : 'text-slate-400'}`} />
            {file ? (
              <div className="flex flex-col items-center">
                <p className="text-sm font-medium text-slate-900 truncate max-w-full px-4">{file.name}</p>
                <p className="text-xs text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-700">Drag & drop file here</p>
                <p className="text-xs text-slate-500 mt-1">or click to browse</p>
              </>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Languages className="w-4 h-4" />
                Language Override
              </label>
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
              >
                <option value="auto">Auto-Detect</option>
                <option value="English">English</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
                <option value="German">German</option>
                <option value="Japanese">Japanese</option>
                <option value="Korean">Korean</option>
                <option value="Arabic">Arabic</option>
              </select>
            </div>

            <button
              onClick={handleExtract}
              disabled={!file || isProcessing}
              className={`w-full py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
                !file || isProcessing 
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Extracting Text...
                </>
              ) : (
                <>
                  Extract Text
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Side: Results */}
        <div className="flex-1 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Extracted Content
            </h3>
            {extractedText && (
              <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Success
              </span>
            )}
          </div>
          
          <div className="flex-1 relative rounded-xl border border-slate-200 bg-slate-50 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
            {isProcessing ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-slate-50/80 backdrop-blur-sm z-10">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
                <p className="font-medium">Using AI to analyze document...</p>
                <p className="text-sm mt-1">This may take a few seconds.</p>
              </div>
            ) : null}
            
            <textarea
              className="w-full h-full p-6 resize-none bg-transparent outline-none text-slate-700 leading-relaxed placeholder-slate-400"
              placeholder={file ? 'Click "Extract Text" to process the uploaded file.' : 'Upload a file to begin.'}
              value={extractedText}
              onChange={(e) => setExtractedText(e.target.value)}
              disabled={isProcessing}
            />
          </div>
          
          {extractedText && (
            <div className="mt-4 flex justify-end gap-3">
              <button 
                onClick={async () => {
                  const success = await copyToClipboard(extractedText);
                  if (success) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                {copied ? (
                  <><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Copied!</>
                ) : (
                  'Copy to Clipboard'
                )}
              </button>
              <button 
                onClick={() => {
                  const blob = new Blob([extractedText], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${file?.name || 'document'}_extracted.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
              >
                Download .txt
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
