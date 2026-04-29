import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Layers, ArrowDownUp, CheckCircle2, ChevronRight, Trash2 } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { downloadBlob, fileToBase64 } from '../../lib/utils';

export function MergeTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
    setSuccessMsg('');
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    }
  } as any);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const moveFile = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === files.length - 1) return;
    
    setFiles(prev => {
      const newFiles = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      const temp = newFiles[index];
      newFiles[index] = newFiles[targetIndex];
      newFiles[targetIndex] = temp;
      return newFiles;
    });
  };

  const handleMerge = async () => {
    if (files.length < 2) return;
    
    setIsProcessing(true);
    setSuccessMsg('');
    
    try {
      // Create a new PDFDocument
      const mergedPdf = await PDFDocument.create();

      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedPdfFile = await mergedPdf.save();
      const blob = new Blob([mergedPdfFile], { type: 'application/pdf' });
      downloadBlob(blob, 'merged_document.pdf');
      
      setSuccessMsg('PDFs successfully merged and downloaded!');
    } catch (error) {
      console.error(error);
      alert('Error merging PDFs. Make sure they are valid PDF files.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1">
        
        {/* Top: Upload Area */}
        <div className="p-8 border-b border-slate-200 bg-slate-50/30">
          <div className="mb-4 text-center">
            <h2 className="text-xl font-bold text-slate-800">Merge Multiple PDFs</h2>
            <p className="text-slate-500 mt-1">Combine documents in the exact order you want.</p>
          </div>
          
          <div 
            {...getRootProps()} 
            className={`max-w-2xl mx-auto border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-amber-500 bg-amber-50' : 'border-slate-300 hover:border-slate-400 bg-white'
            }`}
          >
            <input {...getInputProps()} />
            <UploadCloud className={`w-12 h-12 mb-4 ${isDragActive ? 'text-amber-500' : 'text-slate-400'}`} />
            <p className="text-base font-medium text-slate-700">Drag & drop multiple PDFs here</p>
            <p className="text-sm text-slate-500 mt-1">or click to choose files from your computer</p>
          </div>
        </div>

        {/* Bottom: File List & Action */}
        <div className="flex-1 p-8 flex flex-col xl:flex-row gap-8 overflow-hidden bg-white">
          <div className="flex-1 flex flex-col overflow-hidden">
            <h3 className="text-lg font-medium text-slate-900 mb-4 flex items-center justify-between">
              <span>File Sequence ({files.length})</span>
              {files.length > 0 && (
                <button onClick={() => setFiles([])} className="text-sm text-slate-500 hover:text-rose-600 transition-colors">
                  Clear All
                </button>
              )}
            </h3>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 pb-4">
              {files.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl p-8 text-center bg-slate-50">
                  <Layers className="w-12 h-12 mb-3 text-slate-300" />
                  <p>No files added yet.</p>
                  <p className="text-sm mt-1">Upload at least 2 files to merge.</p>
                </div>
              ) : (
                files.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="bg-white border border-slate-200 p-4 rounded-xl flex items-center gap-4 shadow-sm hover:border-amber-200 transition-colors group">
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-medium flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-100 xl:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => moveFile(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1.5 text-slate-400 hover:text-slate-800 disabled:opacity-30 transition-colors rounded-md hover:bg-slate-100"
                        title="Move Up"
                      >
                        <ArrowDownUp className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => moveFile(idx, 'down')}
                        disabled={idx === files.length - 1}
                        className="p-1.5 text-slate-400 hover:text-slate-800 disabled:opacity-30 transition-colors rounded-md hover:bg-slate-100"
                        title="Move Down"
                      >
                        <ArrowDownUp className="w-4 h-4 rotate-180" />
                      </button>
                      <div className="w-px h-6 bg-slate-200 mx-1"></div>
                      <button 
                        onClick={() => removeFile(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors rounded-md hover:bg-rose-50"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Action Sidebar */}
          <div className="w-full xl:w-80 flex flex-col gap-4 bg-slate-50 p-6 rounded-xl border border-slate-100 shrink-0 h-fit">
            <h3 className="text-base font-semibold text-slate-800">Merge Settings</h3>
            <p className="text-sm text-slate-600 mb-2">Files will be merged in the numerical order shown on the left.</p>
            
            <button
              onClick={handleMerge}
              disabled={files.length < 2 || isProcessing}
              className={`w-full py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                files.length < 2 || isProcessing 
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed' 
                  : 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20'
              }`}
            >
              {isProcessing ? 'Merging...' : 'Merge Documents'}
              {!isProcessing && <ChevronRight className="w-5 h-5" />}
            </button>
            
            {successMsg && (
              <div className="mt-2 p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-sm text-emerald-800 flex items-start gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}
            
            <div className="mt-4 text-xs text-slate-500 flex items-start gap-2">
              <span className="shrink-0 bg-slate-200 w-4 h-4 rounded-full flex items-center justify-center mt-0.5">i</span>
              Processing happens entirely in your browser. Your files are not sent to any server.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
