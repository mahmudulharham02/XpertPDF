import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Scissors, CheckCircle2, FileUp, ListOrdered, FileOutput } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { downloadBlob, sanitizePdfBytes, loadPdf } from '../../lib/utils';
import * as pdfjsLib from 'pdfjs-dist';

export function SplitTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pagesInput, setPagesInput] = useState("");
  const [splitMode, setSplitMode] = useState<'extract' | 'individual' | 'every-n'>('extract');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const f = acceptedFiles[0];
      setFile(f);
      setSuccessMsg('');
      setErrorMsg('');
      try {
        const arrayBuffer = await f.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
        setPdfDoc(pdf);
      } catch (err) {
        console.error(err);
        setPdfDoc(null);
        setErrorMsg('Error loading PDF preview.');
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false
  } as any);

  const parsePages = (input: string, totalPages: number): number[] => {
    const result = new Set<number>();
    const cleaned = input.replace(/\s+/g, '').toLowerCase();

    if (cleaned === 'all') {
      for (let i = 0; i < totalPages; i++) result.add(i);
      return Array.from(result).sort((a,b)=>a-b);
    }
    if (cleaned === 'odd') {
      for (let i = 0; i < totalPages; i += 2) result.add(i);
      return Array.from(result).sort((a,b)=>a-b);
    }
    if (cleaned === 'even') {
      for (let i = 1; i < totalPages; i += 2) result.add(i);
      return Array.from(result).sort((a,b)=>a-b);
    }
    if (cleaned === 'last') {
      result.add(totalPages - 1);
      return Array.from(result).sort((a,b)=>a-b);
    }

    cleaned.split(",").forEach(part => {
      if (!part) return;
      if (part.includes("-")) {
        const [start, end] = part.split("-").map(n => parseInt(n));
        if (!isNaN(start) && !isNaN(end)) {
           const s = Math.min(start, end) - 1;
           const e = Math.max(start, end) - 1;
           for (let i = s; i <= e; i++) {
             if (i >= 0 && i < totalPages) result.add(i);
           }
        }
      } else {
        const n = parseInt(part) - 1;
        if (!isNaN(n) && n >= 0 && n < totalPages) {
          result.add(n);
        }
      }
    });

    return Array.from(result).sort((a,b)=>a-b);
  };

  const downloadZip = async (blobs: Blob[], fnames: string[]) => {
      // In a real app we'd use jszip. 
      // For now, if there's only one blob, we download it. 
      // Multi-file download without JSZip requires multiple links, which browsers block.
      // So we will just sequentially trigger downloads with a small delay for demo purposes,
      // or instruct the user to allow multiple downloads.
      for (let i = 0; i < blobs.length; i++) {
         downloadBlob(blobs[i], fnames[i]);
         if (i < blobs.length - 1) {
            await new Promise(r => setTimeout(r, 500)); 
         }
      }
  };

  const handleSplit = async () => {
    if (!file || !pdfDoc) return;
    setLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const bytes = await file.arrayBuffer();
      const pdf = await loadPdf(new Uint8Array(bytes), { ignoreEncryption: true });
      const totalPages = pdf.getPageCount();

      if (splitMode === 'extract') {
         if (!pagesInput) throw new Error("Please specify pages to extract. (e.g. 1-3, 5)");
         const selectedPages = parsePages(pagesInput, totalPages);
         if (selectedPages.length === 0) throw new Error("No valid pages selected.");

         const newPdf = await PDFDocument.create();
         const copiedPages = await newPdf.copyPages(pdf, selectedPages);
         copiedPages.forEach(p => newPdf.addPage(p));
         const newBytes = await newPdf.save();
         downloadBlob(new Blob([newBytes], { type: "application/pdf" }), file.name.replace('.pdf', '_extracted.pdf'));
      } 
      else if (splitMode === 'individual') {
         const blobs = [];
         const names = [];
         for (let i = 0; i < totalPages; i++) {
            const newPdf = await PDFDocument.create();
            const [copiedPage] = await newPdf.copyPages(pdf, [i]);
            newPdf.addPage(copiedPage);
            const newBytes = await newPdf.save();
            blobs.push(new Blob([newBytes], { type: "application/pdf" }));
            names.push(file.name.replace('.pdf', `_page_${i+1}.pdf`));
         }
         await downloadZip(blobs, names);
      }
      else if (splitMode === 'every-n') {
         const n = parseInt(pagesInput);
         if (isNaN(n) || n <= 0) throw new Error("Please specify a valid number for N.");
         const blobs = [];
         const names = [];
         for (let i = 0; i < totalPages; i += n) {
            const newPdf = await PDFDocument.create();
            const pageIndices = [];
            for (let j = i; j < Math.min(i + n, totalPages); j++) pageIndices.push(j);
            const copiedPages = await newPdf.copyPages(pdf, pageIndices);
            copiedPages.forEach(p => newPdf.addPage(p));
            const newBytes = await newPdf.save();
            blobs.push(new Blob([newBytes], { type: "application/pdf" }));
            names.push(file.name.replace('.pdf', `_part_${Math.floor(i/n)+1}.pdf`));
         }
         await downloadZip(blobs, names);
      }

      setSuccessMsg('PDF processing successful!');
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'Error processing PDF.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col pt-4 animate-in fade-in slide-in-from-bottom-4 duration-300 h-full w-full max-w-full">
      <div className="liquid-panel rounded-[24px] overflow-y-auto overflow-x-hidden flex flex-col flex-1 shadow-lg shadow-black/5 w-full">
        
        {/* Top: Upload Area */}
        <div className="p-10 border-b border-black/5 dark:border-white/10 bg-white/20 dark:bg-black/20">
          <div className="mb-6 text-center">
             <div className="w-16 h-16 liquid-panel rounded-[24px] text-fuchsia-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-fuchsia-500/10">
               <Scissors className="w-8 h-8" />
             </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Split PDF</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Extract pages or split into multiple files</p>
          </div>
          
          {!file ? (
            <div 
              {...getRootProps()} 
              className={`max-w-2xl mx-auto liquid-panel rounded-[24px] p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 pointer-events-auto ${
                isDragActive ? 'scale-[1.02] bg-fuchsia-50/50 dark:bg-fuchsia-900/20 border-fuchsia-400' : 'hover:bg-white/40 dark:hover:bg-white/5 border-dashed border-2 border-fuchsia-200 dark:border-fuchsia-800/50'
              }`}
            >
              <input {...getInputProps()} />
              <UploadCloud className={`w-12 h-12 mb-4 ${isDragActive ? 'text-fuchsia-500' : 'text-slate-400 dark:text-slate-500'}`} />
              <p className="text-lg font-bold text-slate-700 dark:text-slate-200">Drag & drop a PDF here</p>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">or click to choose file</p>
            </div>
          ) : (
            <div className="w-full max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between liquid-panel p-4 rounded-xl px-6 gap-4">
               <div className="flex items-center gap-3 w-full sm:w-auto overflow-hidden">
                  <div className="w-10 h-10 rounded-lg bg-fuchsia-100 dark:bg-fuchsia-900/30 flex items-center justify-center text-fuchsia-600">
                     <FileUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm border-none font-bold text-slate-700 dark:text-white line-clamp-1">{file.name}</h3>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB • {pdfDoc?.numPages} pages</p>
                  </div>
               </div>
               <button 
                  onClick={() => { setFile(null); setPdfDoc(null); setSuccessMsg(''); setErrorMsg(''); }}
                  className="px-4 py-2 text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors w-full sm:w-auto shrink-0"
               >
                  Change File
               </button>
            </div>
          )}
        </div>

        {/* Bottom: Options & Action */}
        <div className="flex-1 p-8 flex flex-col items-center bg-transparent relative">
          
          {file && (
             <div className="w-full max-w-2xl space-y-6">
                
                {errorMsg && (
                  <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 p-4 rounded-xl text-sm font-bold border border-rose-100 dark:border-rose-900/50">
                    {errorMsg}
                  </div>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                  <button onClick={() => setSplitMode('extract')} className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all ${splitMode === 'extract' ? 'border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-900/10' : 'border-transparent bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10'}`}>
                    <ListOrdered className={`w-5 h-5 mb-2 ${splitMode === 'extract' ? 'text-fuchsia-500' : 'text-slate-400'}`} />
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Extract Pages</span>
                    <span className="text-xs font-medium text-slate-500 mt-1 line-clamp-2 text-left">Create a new PDF with selected pages.</span>
                  </button>
                  <button onClick={() => setSplitMode('individual')} className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all ${splitMode === 'individual' ? 'border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-900/10' : 'border-transparent bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10'}`}>
                    <FileOutput className={`w-5 h-5 mb-2 ${splitMode === 'individual' ? 'text-fuchsia-500' : 'text-slate-400'}`} />
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">1 File per Page</span>
                    <span className="text-xs font-medium text-slate-500 mt-1 line-clamp-2 text-left">Split entirely into single pages.</span>
                  </button>
                  <button onClick={() => setSplitMode('every-n')} className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all ${splitMode === 'every-n' ? 'border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-900/10' : 'border-transparent bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10'}`}>
                    <Scissors className={`w-5 h-5 mb-2 ${splitMode === 'every-n' ? 'text-fuchsia-500' : 'text-slate-400'}`} />
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Every N Pages</span>
                    <span className="text-xs font-medium text-slate-500 mt-1 line-clamp-2 text-left">Chunk PDF into smaller files.</span>
                  </button>
                </div>

                <div className="liquid-panel rounded-xl p-5 border border-black/5 dark:border-white/10">
                   {splitMode === 'extract' && (
                     <div>
                       <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Pages to Extract</label>
                       <input 
                         type="text" 
                         value={pagesInput}
                         onChange={e => setPagesInput(e.target.value)}
                         placeholder="e.g. 1-3, 5, 8-10, odd, even, last" 
                         className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-fuchsia-500 outline-none text-slate-800 dark:text-white"
                       />
                       <p className="text-xs text-slate-500 mt-2 font-medium">Valid formats: exact numbers (1,5,6), ranges (2-10), "odd", "even", "last", "all"</p>
                     </div>
                   )}
                   {splitMode === 'individual' && (
                     <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        This will extract each of the <strong className="text-slate-800 dark:text-white">{pdfDoc?.numPages}</strong> pages into separate PDF files. Note: browsers will prompt to download multiple files.
                     </p>
                   )}
                   {splitMode === 'every-n' && (
                     <div>
                       <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Pages per chunk (N)</label>
                       <input 
                         type="number" 
                         min="1"
                         value={pagesInput}
                         onChange={e => setPagesInput(e.target.value)}
                         placeholder="e.g. 5" 
                         className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-fuchsia-500 outline-none text-slate-800 dark:text-white"
                       />
                       <p className="text-xs text-slate-500 mt-2 font-medium">Split the PDF into multiple files, each containing N pages.</p>
                     </div>
                   )}
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between pt-4 gap-4 w-full">
                  {successMsg ? (
                    <div className="flex-1 flex items-center gap-2 text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-lg w-full sm:w-auto overflow-hidden">
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      <span className="truncate">{successMsg}</span>
                    </div>
                  ) : <div className="hidden sm:block"></div>}
                  
                  <button 
                    onClick={handleSplit}
                    disabled={loading || (splitMode === 'extract' && !pagesInput) || (splitMode === 'every-n' && !pagesInput)}
                    className="flex justify-center items-center gap-2 px-8 py-3.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl font-bold shadow-lg shadow-fuchsia-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95 w-full sm:w-auto shrink-0"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Scissors className="w-5 h-5" />
                        Split PDF
                      </>
                    )}
                  </button>
                </div>

             </div>
          )}
        </div>
      </div>
    </div>
  );
}
