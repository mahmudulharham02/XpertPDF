import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, BookOpen, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, Maximize, Minimize, Settings2, Download, PenTool, Search } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-expect-error Vite handles this
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import { downloadBlob } from '../../lib/utils';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

// Page component
function PdfPage({ 
  pageNumber, 
  pdfDoc, 
  scale, 
  drawMode, 
  strokeSize,
  onSaveDrawing 
}: { 
  pageNumber: number; 
  pdfDoc: any; 
  scale: number; 
  drawMode: boolean;
  strokeSize: number;
  onSaveDrawing: (pageNum: number, canvas: HTMLCanvasElement) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    let renderTask: any;
    if (pdfDoc && canvasRef.current) {
      pdfDoc.getPage(pageNumber).then((page: any) => {
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (drawCanvasRef.current) {
          drawCanvasRef.current.width = viewport.width;
          drawCanvasRef.current.height = viewport.height;
        }

        renderTask = page.render({ canvasContext: ctx, viewport });
        renderTask.promise.then(() => {
          setRendered(true);
        }).catch((e: any) => {
          if(e.name !== 'RenderingCancelledException') {
            console.error('Render error', e);
          }
        });
      });
    }
    return () => {
      if (renderTask) renderTask.cancel();
    }
  }, [pdfDoc, pageNumber, scale]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawMode) return;
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    if (!drawMode) return;
    setIsDrawing(false);
    if (!drawCanvasRef.current) return;
    const ctx = drawCanvasRef.current.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      // Notify parent about drawing updates
      onSaveDrawing(pageNumber, drawCanvasRef.current);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawMode || !drawCanvasRef.current) return;
    const canvas = drawCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineWidth = strokeSize;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ef4444'; // Red marker

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  return (
    <div className="relative shadow-xl bg-white border border-slate-200 mx-auto my-4" style={{ width: 'fit-content' }}>
      {!rendered && (
        <div className="absolute inset-0 bg-slate-50 flex items-center justify-center">
           <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      )}
      <canvas ref={canvasRef} className="max-w-full h-auto align-top" />
      <canvas 
        ref={drawCanvasRef}
        className={`absolute top-0 left-0 w-full h-full align-top touch-none ${drawMode ? 'cursor-crosshair z-10' : 'pointer-events-none'}`}
        onMouseDown={startDrawing}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        onMouseMove={draw}
        onTouchStart={startDrawing}
        onTouchEnd={stopDrawing}
        onTouchMove={draw}
      />
    </div>
  );
}

export function ViewerTool() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  const [scale, setScale] = useState<number>(window.innerWidth < 768 ? 1.0 : 1.5);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [strokeSize, setStrokeSize] = useState(3);
  const [showHeader, setShowHeader] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const drawingsRef = useRef<Map<number, string>>(new Map());

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const f = acceptedFiles[0];
      setFile(f);
      setFileName(f.name);
      setIsLoading(true);
      drawingsRef.current.clear();
      
      try {
        const arrayBuffer = await f.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        setPdfDoc(pdf);
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
    setFile(null);
    setFileName('');
  };

  const zoomIn = () => setScale(p => Math.min(p + 0.25, 3.0));
  const zoomOut = () => setScale(p => Math.max(p - 0.25, 0.5));

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(e => {
        console.error(e);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleSaveDrawing = (pageNum: number, canvas: HTMLCanvasElement) => {
    drawingsRef.current.set(pageNum, canvas.toDataURL('image/png'));
  };

  const handleSaveEditedPdf = async () => {
    if (!file) return;
    setIsLoading(true);
    try {
      const fileBytes = await file.arrayBuffer();
      const pdf = await PDFDocument.load(fileBytes);
      const pages = pdf.getPages();

      const entries = Array.from(drawingsRef.current.entries()) as [number, string][];
      for (const [pageNum, dataUrl] of entries) {
        const signatureBytes = await fetch(dataUrl).then(res => res.arrayBuffer());
        const pngImage = await pdf.embedPng(signatureBytes);
        
        const pageIndex = pageNum - 1;
        if (pages[pageIndex]) {
          const page = pages[pageIndex];
          const { width, height } = page.getSize();
          page.drawImage(pngImage, {
            x: 0,
            y: 0,
            width: width,
            height: height
          });
        }
      }

      const pdfBytes = await pdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      downloadBlob(blob, fileName.replace('.pdf', '_edited.pdf'));
    } catch (error) {
      console.error("Save error", error);
      alert("Could not save edited PDF.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-full">
      <div 
        ref={containerRef}
        className={`bg-white shadow-sm border border-slate-200 flex flex-col flex-1 ${isFullscreen ? 'rounded-none' : 'rounded-xl'}`}
      >
        
        {!pdfDoc && !isLoading ? (
          <div className="p-10 flex flex-col items-center justify-center min-h-[600px] text-center">
            <div className="w-16 h-16 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-6">
              <BookOpen className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">PDF Viewer</h2>
            <p className="text-slate-500 mt-2 max-w-md mb-8">View and read your PDF documents securely in WebToon style.</p>
            
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
        ) : isLoading && !pdfDoc ? (
           <div className="p-10 flex flex-col items-center justify-center min-h-[600px] text-center">
             <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
             <p className="text-lg font-medium text-slate-700">Loading document...</p>
           </div>
        ) : (
          <div className="flex flex-col flex-1 relative bg-slate-100 overflow-hidden" 
               onClick={(e) => {
                 // Toggle header if click is directly on background/container
                 if(e.currentTarget === e.target) setShowHeader(!showHeader) 
               }}
          >
            {/* Horizontal Header Panel */}
            <div className={`absolute top-0 left-0 right-0 z-30 transition-transform duration-300 ${showHeader ? 'translate-y-0' : '-translate-y-full'}`}>
              <div className="bg-slate-800 text-white flex flex-wrap gap-3 items-center justify-between px-4 py-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-blue-400" />
                  <span className="font-medium truncate max-w-32 md:max-w-xs">{fileName}</span>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                   {/* Draw Mode Actions */}
                   <button 
                     onClick={() => setDrawMode(!drawMode)}
                     className={`p-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${drawMode ? 'bg-rose-500 text-white' : 'bg-slate-700 text-slate-300 hover:text-white hover:bg-slate-600'}`}
                   >
                     <PenTool className="w-4 h-4" /> <span className="hidden sm:inline">Draw</span>
                   </button>
                   
                   {drawMode && (
                     <select 
                       value={strokeSize} 
                       onChange={e => setStrokeSize(parseInt(e.target.value))}
                       className="bg-slate-700 text-white border-none rounded-lg text-sm px-2 py-1 outline-none"
                     >
                       <option value={1}>Fine</option>
                       <option value={3}>Medium</option>
                       <option value={6}>Thick</option>
                       <option value={10}>Marker</option>
                     </select>
                   )}

                   <button 
                     onClick={handleSaveEditedPdf}
                     className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                   >
                     <Download className="w-4 h-4" /> <span className="hidden sm:inline">Save</span>
                   </button>

                   {/* Zoom Actions */}
                   <div className="flex items-center bg-slate-700 rounded-lg px-2 py-1 ml-2">
                     <button onClick={zoomOut} className="p-1 hover:bg-slate-600 rounded text-slate-300 hover:text-white" title="Zoom Out">
                       <ZoomOut className="w-4 h-4" />
                     </button>
                     <button onClick={zoomIn} className="p-1 hover:bg-slate-600 rounded text-slate-300 hover:text-white" title="Zoom In">
                       <ZoomIn className="w-4 h-4" />
                     </button>
                   </div>

                   <button onClick={toggleFullscreen} className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors ml-2">
                     {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                   </button>

                   <button onClick={closeViewer} className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors ml-2">
                     <X className="w-4 h-4" />
                   </button>
                </div>
              </div>
            </div>

            {/* Scrollable Container (WebToon Style) */}
            <div 
               className="flex-1 overflow-auto bg-slate-100 p-2 sm:p-4 touch-pan-x touch-pan-y"
               onClick={() => setShowHeader(h => !h)}
            >
               {pdfDoc && Array.from({ length: pdfDoc.numPages }).map((_, i) => (
                 <div key={i} onClick={(e) => e.stopPropagation()}>
                   <PdfPage 
                     pageNumber={i + 1} 
                     pdfDoc={pdfDoc} 
                     scale={scale} 
                     drawMode={drawMode}
                     strokeSize={strokeSize}
                     onSaveDrawing={handleSaveDrawing}
                   />
                 </div>
               ))}
               
               {isLoading && (
                 <div className="fixed inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                 </div>
               )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
