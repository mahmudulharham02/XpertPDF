import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileImage, DownloadCloud, Image as ImageIcon, Loader2, CheckSquare, Square, Download, Trash2, Archive } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

// @ts-expect-error Vite handles this
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

interface PagePreview {
  pageNum: number;
  dataUrl: string;
}

export function PdfToImageTool() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pages, setPages] = useState<PagePreview[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [format, setFormat] = useState<'png' | 'jpeg'>('png');
  const [quality, setQuality] = useState<number>(0.9);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const f = acceptedFiles[0];
      setFile(f);
      setFileName(f.name);
      setPages([]);
      setSelectedPages(new Set());
      setIsProcessing(true);

      try {
        const arrayBuffer = await f.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const totalPages = pdf.numPages;
        
        const extractedPages: PagePreview[] = [];
        
        for (let i = 1; i <= totalPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          const renderContext = {
            canvasContext: ctx,
            viewport: viewport,
          };
          
          await page.render(renderContext).promise;
          
          // Store a thumbnail or default quality image just for preview
          const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
          extractedPages.push({ pageNum: i, dataUrl });
        }
        
        setPages(extractedPages);
      } catch (error) {
        console.error('Error processing PDF:', error);
        alert('Failed to process PDF.');
      } finally {
        setIsProcessing(false);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1
  } as any);

  const togglePageSelection = (pageNum: number) => {
    setSelectedPages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pageNum)) {
        newSet.delete(pageNum);
      } else {
        newSet.add(pageNum);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    if (selectedPages.size === pages.length) {
      setSelectedPages(new Set());
    } else {
      setSelectedPages(new Set(pages.map(p => p.pageNum)));
    }
  };

  const getFullQualityImage = async (pageNum: number): Promise<string> => {
    if (!file) throw new Error("No file");
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    const page = await pdf.getPage(pageNum);
    // Use a higher scale for physical output (e.g., 2.0 or 3.0)
    const viewport = page.getViewport({ scale: 3.0 });
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("No canvas context");
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    // Fill white background for JPEG
    if (format === 'jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
    };
    
    await page.render(renderContext).promise;
    return canvas.toDataURL(`image/${format}`, quality);
  };

  const downloadSelected = async () => {
    if (selectedPages.size === 0) return;
    
    setIsProcessing(true);
    try {
      const pagesToDownload = Array.from(selectedPages).sort((a, b) => a - b);
      
      if (pagesToDownload.length === 1) {
        // Download single file
        const pageNum = pagesToDownload[0];
        const dataUrl = await getFullQualityImage(pageNum);
        downloadFile(dataUrl, `${fileName.replace(/\.pdf$/i, '')}_page_${pageNum}.${format}`);
      } else {
        // Download ZIP
        const zip = new JSZip();
        for (const pageNum of pagesToDownload) {
          const dataUrl = await getFullQualityImage(pageNum);
          const base64Data = dataUrl.split(',')[1];
          zip.file(`${fileName.replace(/\.pdf$/i, '')}_page_${pageNum}.${format}`, base64Data, { base64: true });
        }
        
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        downloadFile(url, `${fileName.replace(/\.pdf$/i, '')}_images.zip`);
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error("Error generating images", e);
      alert("Failed to generate images");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadFile = (url: string, name: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const clearFile = () => {
    setFile(null);
    setFileName('');
    setPages([]);
    setSelectedPages(new Set());
  };

  return (
    <div className="flex-1 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1 h-full">
        
        {!file && !isProcessing ? (
          <div className="flex-1 p-8 flex flex-col items-center justify-center">
             <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                <FileImage className="w-8 h-8" />
             </div>
             <h2 className="text-2xl font-bold text-slate-800 mb-2">PDF to Image</h2>
             <p className="text-slate-500 max-w-md text-center mb-8">
               Convert PDF pages to high-quality JPG or PNG images.
             </p>
             
             <div 
               {...getRootProps()} 
               className={`w-full max-w-xl mx-auto border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                 isDragActive ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100'
               }`}
             >
               <input {...getInputProps()} />
               <UploadCloud className={`w-12 h-12 mb-4 ${isDragActive ? 'text-emerald-500' : 'text-slate-400'}`} />
               <p className="text-lg font-medium text-slate-700">Drag & drop your PDF here</p>
               <p className="text-sm text-slate-500 mt-2">or click directly to browse</p>
             </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Header / Options */}
            <div className="bg-slate-50 border-b border-slate-200 p-4 px-6 flex flex-wrap gap-4 items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                 <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg shrink-0">
                   <FileImage className="w-5 h-5" />
                 </div>
                 <div className="min-w-0">
                   <h3 className="font-medium text-slate-900 truncate">{fileName}</h3>
                   <p className="text-xs text-slate-500">{pages.length} pages</p>
                 </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                 <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1">
                   <select 
                     value={format} 
                     onChange={(e) => setFormat(e.target.value as any)}
                     className="bg-transparent text-sm border-none outline-none font-medium text-slate-700 px-2 cursor-pointer"
                   >
                     <option value="png">PNG</option>
                     <option value="jpeg">JPEG</option>
                   </select>
                 </div>

                 {format === 'jpeg' && (
                   <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1">
                     <select 
                       value={quality} 
                       onChange={(e) => setQuality(parseFloat(e.target.value))}
                       className="bg-transparent text-sm border-none outline-none font-medium text-slate-700 px-2 cursor-pointer"
                     >
                       <option value={0.7}>Normal</option>
                       <option value={0.9}>High</option>
                       <option value={1.0}>Max</option>
                     </select>
                   </div>
                 )}

                 <button 
                   onClick={clearFile}
                   className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                   title="Clear"
                 >
                   <Trash2 className="w-5 h-5" />
                 </button>
              </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 overflow-y-auto bg-slate-100 p-6">
              {isProcessing && pages.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-slate-500">
                    <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
                    <p className="font-medium">Extracting pages...</p>
                 </div>
              ) : (
                <div className="max-w-5xl mx-auto space-y-4">
                  <div className="flex items-center justify-between pb-2">
                    <button 
                      onClick={selectAll}
                      className="text-sm font-medium text-slate-600 hover:text-emerald-600 flex items-center gap-1.5"
                    >
                      {selectedPages.size === pages.length && pages.length > 0 ? (
                        <><CheckSquare className="w-4 h-4" /> Deselect All</>
                      ) : (
                        <><Square className="w-4 h-4" /> Select All</>
                      )}
                    </button>
                    <span className="text-sm text-slate-500">
                      {selectedPages.size} selected
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {pages.map((p) => {
                      const isSelected = selectedPages.has(p.pageNum);
                      return (
                        <div 
                          key={p.pageNum}
                          onClick={() => togglePageSelection(p.pageNum)}
                          className={`relative group bg-white rounded-xl shadow-sm border-2 overflow-hidden cursor-pointer transition-all ${
                            isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-transparent hover:border-slate-300'
                          }`}
                        >
                          <div className="aspect-[1/1.4] bg-slate-100 relative">
                            <img src={p.dataUrl} alt={`Page ${p.pageNum}`} className="w-full h-full object-contain" />
                            <div className={`absolute top-3 right-3 w-6 h-6 rounded bg-white shadow flex items-center justify-center border-2 transition-colors ${
                              isSelected ? 'border-emerald-500 text-emerald-500' : 'border-slate-300 text-transparent group-hover:border-slate-400'
                            }`}>
                              {isSelected && <CheckSquare className="w-5 h-5" />}
                            </div>
                          </div>
                          <div className="p-3 text-center border-t border-slate-100 bg-slate-50">
                             <span className="text-sm font-medium text-slate-700">Page {p.pageNum}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Floating Bar */}
            {selectedPages.size > 0 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white px-6 py-4 rounded-2xl shadow-xl border border-slate-200 flex items-center gap-6 animate-in slide-in-from-bottom-8">
                 <div className="text-sm font-medium text-slate-700">
                   {selectedPages.size} page{selectedPages.size > 1 ? 's' : ''} ready
                 </div>
                 <button
                   onClick={downloadSelected}
                   disabled={isProcessing}
                   className={`px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 text-white shadow-md transition-all ${
                     isProcessing ? 'bg-emerald-400' : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95'
                   }`}
                 >
                   {isProcessing ? (
                     <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                   ) : (
                     <>
                       {selectedPages.size > 1 ? <Archive className="w-5 h-5"/> : <Download className="w-5 h-5" />}
                       {selectedPages.size > 1 ? 'Download ZIP' : 'Download Image'}
                     </>
                   )}
                 </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
