import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, BookOpen, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export function ViewerTool() {
  const [fileName, setFileName] = useState<string>('');
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState<number>(1);
  const [pageRendering, setPageRendering] = useState<boolean>(false);
  const [pageNumPending, setPageNumPending] = useState<number | null>(null);
  const [scale, setScale] = useState<number>(1.5);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setFileName(file.name);
      setIsLoading(true);
      
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        setPdfDoc(pdf);
        setPageNum(1);
      } catch (error) {
        console.error('Error loading PDF:', error);
        alert('Failed to load PDF.');
      } finally {
        setIsLoading(false);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1
  } as any);

  const closeViewer = () => {
    setPdfDoc(null);
    setFileName('');
    setPageNum(1);
  };

  const renderPage = useCallback((num: number, currentPdf: any, currentScale: number) => {
    setPageRendering(true);
    
    currentPdf.getPage(num).then((page: any) => {
      const viewport = page.getViewport({ scale: currentScale });
      const canvas = canvasRef.current;
      
      if (!canvas) {
        setPageRendering(false);
        return;
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };
      
      const renderTask = page.render(renderContext);
      renderTask.promise.then(() => {
        setPageRendering(false);
        if (pageNumPending !== null) {
          renderPage(pageNumPending, currentPdf, currentScale);
          setPageNumPending(null);
        }
      });
    });
  }, [pageNumPending]);

  useEffect(() => {
    if (pdfDoc) {
      renderPage(pageNum, pdfDoc, scale);
    }
  }, [pdfDoc, pageNum, scale, renderPage]);

  const queueRenderPage = (num: number) => {
    if (pageRendering) {
      setPageNumPending(num);
    } else {
      setPageNum(num);
    }
  };

  const onPrevPage = () => {
    if (pageNum <= 1) return;
    queueRenderPage(pageNum - 1);
  };

  const onNextPage = () => {
    if (!pdfDoc || pageNum >= pdfDoc.numPages) return;
    queueRenderPage(pageNum + 1);
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.5, 3.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));

  return (
    <div className="flex-1 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1">
        
        {!pdfDoc && !isLoading ? (
          <div className="p-10 flex flex-col items-center justify-center min-h-[600px] text-center">
            <div className="w-16 h-16 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-6">
              <BookOpen className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">PDF Viewer</h2>
            <p className="text-slate-500 mt-2 max-w-md mb-8">View and read your PDF documents directly in the browser across all environments.</p>
            
            <div 
              {...getRootProps()} 
              className={`w-full max-w-xl border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50'
              }`}
            >
              <input {...getInputProps()} />
              <UploadCloud className="w-12 h-12 mb-4 text-slate-400" />
              <p className="text-lg font-medium text-slate-700">Open a PDF file</p>
              <p className="text-sm text-slate-500 mt-2">Drag and drop or click to browse</p>
            </div>
          </div>
        ) : isLoading ? (
           <div className="p-10 flex flex-col items-center justify-center min-h-[600px] text-center">
             <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
             <p className="text-lg font-medium text-slate-700">Loading document...</p>
           </div>
        ) : (
          <div className="flex flex-col flex-1">
            <div className="bg-slate-800 text-white flex flex-wrap gap-3 items-center justify-between px-4 py-3 shrink-0 sticky top-0 z-20 rounded-t-lg">
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-blue-400" />
                <span className="font-medium truncate max-w-64 md:max-w-md">{fileName}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-700 rounded-lg px-2 py-1 mr-2">
                   <button 
                     onClick={zoomOut}
                     className="p-1 hover:bg-slate-600 rounded text-slate-300 hover:text-white transition-colors"
                     title="Zoom Out"
                   >
                     <ZoomOut className="w-4 h-4" />
                   </button>
                   <span className="text-xs px-2 min-w-[3rem] text-center">{Math.round(scale * 100)}%</span>
                   <button 
                     onClick={zoomIn}
                     className="p-1 hover:bg-slate-600 rounded text-slate-300 hover:text-white transition-colors"
                     title="Zoom In"
                   >
                     <ZoomIn className="w-4 h-4" />
                   </button>
                </div>

                <div className="flex items-center bg-slate-700 rounded-lg px-2 py-1 mr-4">
                  <button 
                    onClick={onPrevPage} 
                    disabled={pageNum <= 1}
                    className="p-1 hover:bg-slate-600 rounded disabled:opacity-50 text-slate-300 hover:text-white transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm px-3 tabular-nums">
                    Page {pageNum} of {pdfDoc?.numPages || 1}
                  </span>
                  <button 
                    onClick={onNextPage} 
                    disabled={pageNum >= (pdfDoc?.numPages || 1)}
                    className="p-1 hover:bg-slate-600 rounded disabled:opacity-50 text-slate-300 hover:text-white transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <button 
                  onClick={closeViewer}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2 text-sm"
                >
                  <X className="w-4 h-4" /> <span className="hidden sm:inline">Close</span>
                </button>
              </div>
            </div>
            
            <div className="flex-1 bg-slate-100 relative p-4 custom-scrollbar rounded-b-lg">
              <div className="flex justify-center min-h-full">
                <div className="relative shadow-xl bg-white border border-slate-200" style={{ minWidth: 'fit-content', minHeight: 'fit-content' }}>
                   {pageRendering && (
                     <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
                       <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                     </div>
                   )}
                   <canvas ref={canvasRef} className="max-w-full h-auto align-top" />
                </div>
              </div>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}
