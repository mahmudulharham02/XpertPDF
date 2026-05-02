import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, BookOpen, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, Maximize, Minimize, Settings2, Download, PenTool, Search } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-expect-error Vite handles this
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import { downloadBlob } from '../../lib/utils';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

// Page component
function PdfPage({ 
  pageNumber, 
  pdfDoc, 
  scale, 
  drawMode, 
  drawTool,
  strokeSize,
  onSaveDrawing 
}: { 
  pageNumber: number; 
  pdfDoc: any; 
  scale: number; 
  drawMode: boolean;
  drawTool: 'pencil' | 'marker' | 'highlighter';
  strokeSize: number;
  onSaveDrawing: (pageNum: number, canvas: HTMLCanvasElement) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    let renderTask: any;
    if (pdfDoc && canvasRef.current) {
      pdfDoc.getPage(pageNumber).then((page: any) => {
        if (isCancelled) return;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Only resize drawCanvas if it hasn't been set up yet to avoid losing drawings
        if (drawCanvasRef.current && drawCanvasRef.current.width !== viewport.width) {
          drawCanvasRef.current.width = viewport.width;
          drawCanvasRef.current.height = viewport.height;
        }

        renderTask = page.render({ canvasContext: ctx, viewport });
        renderTask.promise.then(() => {
          if (!isCancelled) setRendered(true);
        }).catch((e: any) => {
          if(e.name !== 'RenderingCancelledException') {
            console.error('Render error', e);
          }
        });
      }).catch((e: any) => {
        console.error('Get page error', e);
      });
    }
    return () => {
      isCancelled = true;
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
    ctx.lineJoin = 'round';
    
    if (drawTool === 'pencil') {
      ctx.strokeStyle = '#1e293b'; // slate-800
      ctx.globalCompositeOperation = 'source-over';
    } else if (drawTool === 'marker') {
      ctx.strokeStyle = '#ef4444'; // red-500
      ctx.globalCompositeOperation = 'source-over';
    } else if (drawTool === 'highlighter') {
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.05)'; // yellow-400 transparent
      ctx.globalCompositeOperation = 'multiply';
      // Adjust stroke size visually for highlighter
      ctx.lineWidth = strokeSize * 2;
    }

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

    if (drawTool === 'highlighter') {
      // Highlighter draws smoothly but overlaps can get dark. Using small opacity arc.
      ctx.beginPath();
      ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2, false);
      ctx.fillStyle = 'rgba(250, 204, 21, 0.1)';
      ctx.fill();
    } else {
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
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
  
  const [pdfScale, setPdfScale] = useState<number>(window.innerWidth < 768 ? 1.5 : 2.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [drawTool, setDrawTool] = useState<'pencil' | 'marker' | 'highlighter'>('pencil');
  const [strokeSize, setStrokeSize] = useState(3);
  const [showHeader, setShowHeader] = useState(true);
  const [hasEdited, setHasEdited] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const drawingsRef = useRef<Map<number, string>>(new Map());

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const f = acceptedFiles[0];
      setFile(f);
      setFileName(f.name);
      setIsLoading(true);
      setHasEdited(false);
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
    setHasEdited(false);
  };

  const [currentScale, setCurrentScale] = useState(1);

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
    setHasEdited(true);
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
    <div className="flex-1 flex flex-col pt-4 animate-in fade-in slide-in-from-bottom-4 duration-300 min-h-full">
      <div 
        ref={containerRef}
        className={`bg-transparent flex flex-col flex-1 ${isFullscreen ? 'rounded-none' : 'rounded-[24px]'}`}
      >
        
        {!pdfDoc && !isLoading ? (
          <div className="p-10 flex flex-col items-center justify-center min-h-[600px] text-center">
            <div className="w-20 h-20 liquid-panel rounded-[24px] text-indigo-500 flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/10">
              <BookOpen className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-semibold text-slate-800 dark:text-white">PDF Viewer</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md mb-8">View and read your PDF documents securely.</p>
            
            <div 
              {...getRootProps()} 
              className={`w-full max-w-xl liquid-panel rounded-[24px] p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${
                isDragActive ? 'scale-[1.02] bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-400' : 'hover:bg-white/40 dark:hover:bg-white/5 border-dashed border-2 border-indigo-200 dark:border-indigo-800'
              }`}
            >
              <input {...getInputProps()} />
              <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                 <UploadCloud className="w-8 h-8 text-indigo-500 dark:text-indigo-400" />
              </div>
              <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">Open a PDF file</p>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">Drag and drop or click to browse</p>
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
            <div className={`absolute top-4 left-4 right-4 z-30 transition-all duration-300 ${showHeader ? 'translate-y-0 opacity-100' : '-translate-y-16 opacity-0 pointer-events-none'}`}>
              <div className="liquid-panel rounded-2xl flex flex-wrap gap-3 items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-indigo-500" />
                  <span className="font-semibold text-slate-800 dark:text-white truncate max-w-32 md:max-w-xs">{fileName}</span>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                   {/* Draw Mode Actions */}
                   <button 
                     onClick={() => setDrawMode(!drawMode)}
                     className={`p-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5 ${drawMode ? 'bg-rose-500 text-white shadow-[0_4px_12px_rgba(244,63,94,0.3)]' : 'liquid-btn-secondary text-slate-700 dark:text-slate-300'}`}
                   >
                     <PenTool className="w-4 h-4" /> <span className="hidden sm:inline">Draw</span>
                   </button>
                   
                   {drawMode && (
                     <div className="flex items-center gap-2 liquid-btn-secondary rounded-xl px-2 py-1 ml-1">
                       <select 
                         value={drawTool} 
                         onChange={e => setDrawTool(e.target.value as any)}
                         className="bg-transparent text-slate-700 dark:text-white border-none text-sm font-medium outline-none cursor-pointer [&>option]:bg-white dark:[&>option]:bg-slate-800"
                       >
                         <option value="pencil">Pencil</option>
                         <option value="marker">Marker</option>
                         <option value="highlighter">Highlighter</option>
                       </select>
                       <div className="w-px h-5 bg-black/10 dark:bg-white/10 mx-1 gap-1"></div>
                       <select 
                         value={strokeSize} 
                         onChange={e => setStrokeSize(parseInt(e.target.value))}
                         className="bg-transparent text-slate-700 dark:text-white border-none text-sm font-medium outline-none cursor-pointer [&>option]:bg-white dark:[&>option]:bg-slate-800"
                       >
                         <option value={1}>Fine</option>
                         <option value={3}>Medium</option>
                         <option value={6}>Thick</option>
                         <option value={10}>Jumbo</option>
                       </select>
                     </div>
                   )}

                   {hasEdited && (
                     <button 
                       onClick={handleSaveEditedPdf}
                       className="p-2 liquid-btn rounded-xl text-sm font-medium flex items-center gap-1.5 ml-1"
                     >
                       <Download className="w-4 h-4" /> <span className="hidden sm:inline">Save</span>
                     </button>
                   )}

                   <button onClick={toggleFullscreen} className="p-2 liquid-btn-secondary text-slate-700 dark:text-slate-300 rounded-xl ml-2">
                     {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                   </button>

                   <button onClick={closeViewer} className="p-2 text-slate-500 dark:text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors ml-1">
                     <X className="w-5 h-5" />
                   </button>
                </div>
              </div>
            </div>

            {/* Scrollable Container (WebToon Style) */}
            <div 
               className="flex-1 overflow-y-auto overflow-x-hidden relative bg-slate-100 dark:bg-black/40 pt-4"
               onClick={() => setShowHeader(h => !h)}
            >
               {pdfDoc && Array.from({ length: pdfDoc.numPages }).map((_, i) => (
                 <div key={i} onClick={(e) => e.stopPropagation()} className="mb-6 mx-auto w-full max-w-5xl px-2 lg:px-8 flex justify-center relative shadow-sm">
                    <TransformWrapper
                       initialScale={1}
                       minScale={1}
                       maxScale={5.0}
                       centerOnInit={true}
                       panning={{ disabled: drawMode }}
                       doubleClick={{ disabled: drawMode }}
                       wheel={{ wheelDisabled: true }}
                       pinch={{ disabled: drawMode }}
                    >
                       {({ state }) => (
                         <TransformComponent 
                            wrapperClass={`!w-auto !h-auto ${state.scale <= 1.01 ? 'touch-pan-y' : 'touch-none cursor-grab active:cursor-grabbing !overflow-hidden z-10 relative'}`} 
                            contentClass="w-auto h-auto transition-transform origin-center"
                         >
                            <PdfPage 
                              pageNumber={i + 1} 
                              pdfDoc={pdfDoc} 
                              scale={pdfScale} 
                              drawMode={drawMode}
                              drawTool={drawTool}
                              strokeSize={strokeSize}
                              onSaveDrawing={handleSaveDrawing}
                            />
                         </TransformComponent>
                       )}
                    </TransformWrapper>
                 </div>
               ))}

               {pdfDoc && (
                 <div className={`fixed bottom-6 right-6 z-40 flex items-center bg-white/40 dark:bg-black/40 rounded-2xl px-2 py-1 shadow-lg ring-1 ring-black/5 dark:ring-white/10 transition-all duration-300 ${showHeader ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`} onClick={e => e.stopPropagation()}>
                    <button onClick={() => setPdfScale(s => Math.max(0.5, s - 0.25))} className="p-3 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl text-slate-700 dark:text-slate-300 transition-colors" title="Zoom Out">
                      <ZoomOut className="w-5 h-5" />
                    </button>
                    <div className="text-sm font-bold font-mono text-slate-700 dark:text-slate-300 w-16 text-center">
                      {Math.round(pdfScale * 100)}%
                    </div>
                    <button onClick={() => setPdfScale(s => Math.min(5.0, s + 0.25))} className="p-3 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl text-slate-700 dark:text-slate-300 transition-colors" title="Zoom In">
                      <ZoomIn className="w-5 h-5" />
                    </button>
                 </div>
               )}
               
               {isLoading && (
                 <div className="fixed inset-0 bg-white/50 dark:bg-black/50 z-50 flex items-center justify-center">
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
