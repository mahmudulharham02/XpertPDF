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
    <div className="flex-1 flex flex-col pt-4 animate-in fade-in slide-in-from-bottom-4 duration-300 h-full">
      <div className="liquid-panel rounded-[24px] overflow-hidden flex flex-col flex-1 shadow-lg shadow-black/5">
        
        {/* Top: Upload Area */}
        <div className="p-10 border-b border-black/5 dark:border-white/10 bg-white/20 dark:bg-black/20">
          <div className="mb-6 text-center">
             <div className="w-16 h-16 liquid-panel rounded-[24px] text-amber-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/10">
               <Layers className="w-8 h-8" />
             </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Merge Multiple PDFs</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Combine documents in the exact order you want.</p>
          </div>
          
          <div 
            {...getRootProps()} 
            className={`max-w-2xl mx-auto liquid-panel rounded-[24px] p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 pointer-events-auto ${
              isDragActive ? 'scale-[1.02] bg-amber-50/50 dark:bg-amber-900/20 border-amber-400' : 'hover:bg-white/40 dark:hover:bg-white/5 border-dashed border-2 border-amber-200 dark:border-amber-800/50'
            }`}
          >
            <input {...getInputProps()} />
            <UploadCloud className={`w-12 h-12 mb-4 ${isDragActive ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'}`} />
            <p className="text-lg font-bold text-slate-700 dark:text-slate-200">Drag & drop multiple PDFs here</p>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">or click to choose files from your computer</p>
          </div>
        </div>

        {/* Bottom: File List & Action */}
        <div className="flex-1 p-8 flex flex-col xl:flex-row gap-8 overflow-hidden bg-transparent">
          <div className="flex-1 flex flex-col overflow-hidden">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center justify-between">
              <span>File Sequence ({files.length})</span>
              {files.length > 0 && (
                <button onClick={() => setFiles([])} className="text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors">
                  Clear All
                </button>
              )}
            </h3>
            
            <div className="flex-1 overflow-y-auto pr-4 space-y-4 pb-4 custom-scrollbar">
              {files.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 border-2 border-dashed border-black/5 dark:border-white/10 rounded-[24px] p-8 text-center bg-white/10 dark:bg-black/10">
                  <Layers className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-600" />
                  <p className="font-semibold text-lg">No files added yet.</p>
                  <p className="text-sm font-medium mt-1">Upload at least 2 files to merge.</p>
                </div>
              ) : (
                files.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="liquid-panel rounded-[16px] p-4 flex items-center gap-4 cursor-grab hover:-translate-y-1 hover:shadow-md transition-all duration-300 group border border-transparent hover:border-amber-500/30">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center shrink-0 shadow-sm">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-slate-800 dark:text-slate-200 truncate">{file.name}</p>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-100 xl:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => moveFile(idx, 'up')}
                        disabled={idx === 0}
                        className="p-2 text-slate-400 hover:text-slate-800 dark:text-slate-500 dark:hover:text-white disabled:opacity-30 transition-colors rounded-xl liquid-btn-secondary"
                        title="Move Up"
                      >
                        <ArrowDownUp className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => moveFile(idx, 'down')}
                        disabled={idx === files.length - 1}
                        className="p-2 text-slate-400 hover:text-slate-800 dark:text-slate-500 dark:hover:text-white disabled:opacity-30 transition-colors rounded-xl liquid-btn-secondary"
                        title="Move Down"
                      >
                        <ArrowDownUp className="w-4 h-4 rotate-180" />
                      </button>
                      <div className="w-px h-6 bg-black/10 dark:bg-white/10 mx-2"></div>
                      <button 
                        onClick={() => removeFile(idx)}
                        className="p-2 text-slate-400 hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-400 transition-colors rounded-xl liquid-btn-secondary"
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
          <div className="w-full xl:w-80 flex flex-col gap-5 liquid-panel p-8 rounded-[24px] shrink-0 h-fit">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Merge Settings</h3>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2 leading-relaxed">Files will be merged in the numerical order shown on the left.</p>
            
            <button
              onClick={handleMerge}
              disabled={files.length < 2 || isProcessing}
              className={`w-full py-4 rounded-[16px] font-bold text-lg flex items-center justify-center gap-2 transition-all duration-300 ${
                files.length < 2 || isProcessing 
                  ? 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed' 
                  : 'liquid-btn'
              }`}
              style={files.length >= 2 && !isProcessing ? { background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.9), rgba(217, 119, 6, 1))', color: 'white', boxShadow: '0 8px 24px rgba(217, 119, 6, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.4)' } : undefined}
            >
              {isProcessing ? 'Merging...' : 'Merge Documents'}
              {!isProcessing && <ChevronRight className="w-5 h-5" />}
            </button>
            
            {successMsg && (
              <div className="mt-2 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-start gap-3 animate-in fade-in">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}
            
            <div className="mt-6 text-xs font-medium text-slate-500 dark:text-slate-400 flex items-start gap-3 bg-white/40 dark:bg-black/20 p-4 rounded-xl border border-black/5 dark:border-white/10">
              <span className="shrink-0 bg-black/10 dark:bg-white/10 w-5 h-5 rounded-full flex items-center justify-center font-bold">i</span>
              <span>Processing happens entirely in your browser. Your files are not sent to any server.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
