import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { TransformWrapper, TransformComponent, useTransformContext, useTransformEffect } from 'react-zoom-pan-pinch';
import { 
  Menu, X, ZoomIn, ZoomOut, Search, Settings, ArrowLeft, Loader2, PenTool, Download, Home, ChevronLeft, ChevronRight
} from 'lucide-react';

// @ts-expect-error Vite handles this
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

// --- Interfaces ---
interface ViewerToolProps {
  onPdfOpen?: (isOpen: boolean) => void;
  onBack?: () => void;
}

interface Stroke {
   points: {x: number, y: number}[];
   color: string;
   thickness: number;
}

interface Annotations {
   highlights: { id: string, rect: {x: number, y: number, w: number, h: number}, color: string }[];
   strokes: Stroke[];
}

export function ViewerTool({ onPdfOpen, onBack }: ViewerToolProps) {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [firstPageRatio, setFirstPageRatio] = useState(1.414);
  const [baseScale, setBaseScale] = useState(1);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Annotation state
  const [annotationMode, setAnnotationMode] = useState<'none' | 'highlight' | 'draw'>('none');
  const [highlightColor, setHighlightColor] = useState('#FFFF00');
  const [drawColor, setDrawColor] = useState('#EF4444');
  const [annotations, setAnnotations] = useState<Record<number, Annotations>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<any>(null);

  useEffect(() => {
    if (onPdfOpen) onPdfOpen(!!pdfFile);
  }, [pdfFile, onPdfOpen]);

  const closeDocument = useCallback(async () => {
    if (pdfDoc) {
      try {
        await pdfDoc.destroy();
      } catch (e) {
        console.error("Error destroying PDF document:", e);
      }
    }
    setPdfDoc(null);
    setPdfFile(null);
    setNumPages(0);
    setAnnotations({});
    setCurrentPage(1);
  }, [pdfDoc]);

  useEffect(() => {
     return () => {
        if (pdfDoc) {
           pdfDoc.destroy().catch(err => console.error("Unmount cleanup error:", err));
        }
     };
  }, [pdfDoc]);

  const scrollToPage = useCallback((pageNum: number) => {
     if (pageNum < 1 || pageNum > numPages) return;
     const parent = transformRef.current;
     if (!parent) return;
     const inst = parent.instance;
     if (!inst || !inst.contentComponent) return;
     
     const pageEl = document.getElementById(`pdf-page-${pageNum}`);
     if (!pageEl) return;
     
     const contentRect = inst.contentComponent.getBoundingClientRect();
     const pageRect = pageEl.getBoundingClientRect();
     const tState = inst.state || inst.transformState || {};
     const scale = tState.scale || 1;
     const positionX = tState.positionX || 0;
     const pageOffsetTop = (pageRect.top - contentRect.top) / scale;
     
     const newPositionY = -(pageOffsetTop * scale) + 16;
     
     const wrapperHeight = inst.wrapperComponent.offsetHeight;
     const contentHeight = inst.contentComponent.offsetHeight * scale;
     const scrollable = contentHeight - wrapperHeight;
     const clampedY = Math.max(-scrollable, Math.min(newPositionY, 0));
     
     const setTransformFunc = parent.setTransform || inst.setTransform;
     if (typeof setTransformFunc === 'function') {
        setTransformFunc(positionX, clampedY, scale, 300);
     }
     setCurrentPage(pageNum);
  }, [numPages]);

  const loadPdf = async (file: File) => {
    setLoading(true); setError('');
    try {
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({
        data: buffer,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true,
      }).promise;
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      setFirstPageRatio(viewport.width / viewport.height);
      setPdfFile(file);
    } catch (err: any) {
       setError('Failed to load PDF. Please make sure the file is a valid PDF and the worker is correctly loaded.');
       console.error("PDF Load Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const updateBaseScale = () => {
      if (containerRef.current && pdfDoc) {
        pdfDoc.getPage(1).then((page) => {
           const viewport = page.getViewport({ scale: 1 });
           const containerWidth = containerRef.current!.clientWidth;
           setBaseScale((containerWidth - 24) / viewport.width);
        });
      }
    };
    updateBaseScale();
    window.addEventListener('resize', updateBaseScale);
    return () => window.removeEventListener('resize', updateBaseScale);
  }, [pdfDoc]);

  const updatePageAnnotations = useCallback((pageNum: number, updateFn: (prev: Annotations) => Annotations) => {
     setAnnotations(prev => {
        const pageAnns = prev[pageNum] || { highlights: [], strokes: [] };
        return { ...prev, [pageNum]: updateFn(pageAnns) };
     });
  }, []);

  const clearAllAnnotations = () => {
     if(window.confirm('Clear all annotations?')) {
        setAnnotations({});
     }
  };

  const handleDownload = () => {
     if (!pdfFile) return;
     const link = document.createElement("a");
     link.href = URL.createObjectURL(pdfFile);
     link.download = pdfFile.name;
     link.click();
  };

  if (!pdfFile) {
    return (
       <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 h-full w-full max-w-full relative">
         {onBack && (
            <button onClick={onBack} className="absolute top-6 left-6 p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300">
               <ArrowLeft className="w-6 h-6" />
            </button>
         )}
         <div className="max-w-md w-full p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 text-center">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Open PDF Document</h2>
            <label className="block w-full py-4 px-4 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium rounded-xl cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border-2 border-dashed border-indigo-200 dark:border-indigo-800">
               <input type="file" accept=".pdf" className="hidden" onChange={e => {
                  if(e.target.files && e.target.files.length > 0) loadPdf(e.target.files[0]);
               }} />
               Select a PDF File
            </label>
            {loading && <p className="mt-4 text-sm text-slate-500 font-medium"><Loader2 className="w-5 h-5 animate-spin inline mr-2 align-middle" /> Loading PDF...</p>}
            {error && <p className="mt-4 text-sm text-rose-500 font-bold bg-rose-50 dark:bg-rose-900/30 p-3 rounded-lg border border-rose-100 dark:border-rose-800">{error}</p>}
         </div>
       </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-200 dark:bg-slate-950 relative overflow-hidden text-slate-900 dark:text-slate-100">
      
      {/* Top Bar */}
      <div 
        className={`absolute top-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-black/10 dark:border-white/10 transition-transform duration-300 ${toolbarVisible ? 'translate-y-0' : '-translate-y-full'}`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
         <div className="flex items-center justify-between px-2 sm:px-4 min-h-[56px] md:min-h-[64px]">
            <div className="flex items-center gap-2">
               <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5" style={{ touchAction: 'manipulation' }}>
                  <Menu className="w-5 h-5" />
               </button>
               {onBack && (
                  <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 hidden sm:block" style={{ touchAction: 'manipulation' }}>
                     <ArrowLeft className="w-5 h-5" />
                  </button>
               )}
               <span className="font-semibold text-xs sm:text-sm truncate max-w-[150px] sm:max-w-[200px] md:max-w-[300px]">
                  {pdfFile.name}
               </span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
               <button onClick={() => setAnnotationMode(m => m === 'draw' ? 'none' : 'draw')} className={`p-2 rounded-xl text-sm font-bold transition-colors ${annotationMode === 'draw' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400' : 'hover:bg-black/5'}`}>
                  <PenTool className="w-4 h-4 sm:w-5 sm:h-5" />
               </button>
               <button onClick={closeDocument} className="px-3 py-1.5 ml-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors border border-black/5 dark:border-white/5 shadow-sm">
                  Close
               </button>
            </div>
         </div>
      </div>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
         <div className="absolute inset-0 z-40 bg-black/50 transition-opacity" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`absolute top-0 bottom-0 left-0 w-72 bg-white dark:bg-slate-900 z-50 transition-transform duration-300 flex flex-col shadow-2xl ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
         <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0 min-h-[56px] md:min-h-[64px]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <h3 className="font-bold">Tools & Pages</h3>
            <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
               <X className="w-5 h-5" />
            </button>
         </div>
         <div className="p-4 flex-1 overflow-y-auto space-y-6">
            <div className="space-y-3">
               <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Document Tools</h4>
               <button onClick={handleDownload} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium border border-slate-200 dark:border-slate-800">
                  <span className="flex items-center gap-2"><Download className="w-4 h-4 text-indigo-500" /> Save Original</span>
               </button>
               <button onClick={async () => { await closeDocument(); setSidebarOpen(false); if(onBack) onBack(); }} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium border border-slate-200 dark:border-slate-800">
                  <span className="flex items-center gap-2"><Home className="w-4 h-4 text-emerald-500" /> Convert Tools Home</span>
               </button>
            </div>

            <div className="space-y-3">
               <div className="flex justify-between items-center">
                 <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Annotations</h4>
                 {Object.keys(annotations).length > 0 && (
                    <button onClick={clearAllAnnotations} className="text-xs text-rose-500 hover:underline">Clear All</button>
                 )}
               </div>
               
               <div className="grid grid-cols-2 gap-2">
                 <div className="flex flex-col gap-2">
                   <div className="text-xs font-bold text-slate-500">Pen Color</div>
                   <input type="color" value={drawColor} onChange={e => setDrawColor(e.target.value)} className="w-full h-8 rounded border-none cursor-pointer p-0" />
                 </div>
               </div>
            </div>

            <div className="space-y-3">
               <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Pages ({numPages})</h4>
               <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: numPages }).map((_, i) => (
                     <button key={i} onClick={() => {
                        scrollToPage(i + 1);
                        setSidebarOpen(false);
                     }} className="aspect-square flex flex-col items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold border border-black/5 dark:border-white/5">
                        {i + 1}
                     </button>
                  ))}
               </div>
            </div>
         </div>
      </div>

      {/* Main Viewer Area */}
      <div className="flex-1 relative w-full h-full" ref={containerRef}>
        {baseScale > 0 && pdfDoc && (
          <TransformWrapper
            ref={transformRef}
            minScale={1}
            maxScale={5}
            initialScale={1}
            wheel={{ step: 0.15 }}
            pinch={{ step: 5 }}
            panning={{ velocityDisabled: true }}
            doubleClick={{ mode: 'zoomIn' }}
            disabled={annotationMode !== 'none'}
          >
            {({ zoomIn, zoomOut, setTransform, instance }) => (
              <>
                 <TransformComponent
                   wrapperStyle={{ width: '100%', height: '100%', overflow: 'hidden' }}
                   contentStyle={{ width: '100%', minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', gap: '12px' }}
                 >
                    <PdfPageList 
                       pdfDoc={pdfDoc} 
                       numPages={numPages} 
                       baseScale={baseScale} 
                       firstPageRatio={firstPageRatio}
                       annotationMode={annotationMode}
                       drawColor={drawColor}
                       annotations={annotations} currentPage={currentPage}
                       updatePageAnnotations={updatePageAnnotations}
                       onClick={(e: any) => {
                          if(annotationMode === 'none') {
                             setToolbarVisible(v => !v);
                          }
                       }}
                    />
                 </TransformComponent>
                 
                  <FloatingScrollbar numPages={numPages} currentPage={currentPage} setCurrentPage={setCurrentPage} />

                  {/* Floating Page Navigation Deck */}
                  <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-black/10 dark:border-white/10 shadow-2xl rounded-full px-3 py-1.5 flex items-center gap-3 transition-all duration-300 ${toolbarVisible ? 'opacity-100' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                     <button 
                        disabled={currentPage <= 1} 
                        onClick={(e) => { e.stopPropagation(); scrollToPage(currentPage - 1); }} 
                        className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-35 disabled:pointer-events-none text-slate-700 dark:text-slate-300 transition-colors"
                     >
                        <ChevronLeft className="w-5 h-5" />
                     </button>
                     <div className="flex items-center gap-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                        <span>Page</span>
                        <input 
                           type="number" 
                           min={1} 
                           max={numPages} 
                           value={currentPage} 
                           onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (val >= 1 && val <= numPages) {
                                 scrollToPage(val);
                              }
                           }}
                           className="w-10 text-center bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded px-1 py-0.5 text-xs font-bold leading-none select-all" 
                        />
                        <span className="text-slate-400 dark:text-slate-500 font-normal">/</span>
                        <span>{numPages}</span>
                     </div>
                     <button 
                        disabled={currentPage >= numPages} 
                        onClick={(e) => { e.stopPropagation(); scrollToPage(currentPage + 1); }} 
                        className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-35 disabled:pointer-events-none text-slate-700 dark:text-slate-300 transition-colors"
                     >
                        <ChevronRight className="w-5 h-5" />
                     </button>
                  </div>
                 
                  {/* Floating Controls */}
                 <div className={`absolute bottom-6 right-6 flex flex-col gap-3 transition-opacity duration-300 ${toolbarVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                   {annotationMode !== 'none' && (
                      <div className="bg-rose-500 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg mb-2 text-center shadow-rose-500/20">
                         Drawing Mode
                      </div>
                   )}
                   <button onClick={(e) => { e.stopPropagation(); zoomIn(); }} className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full shadow-lg flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-black/5 dark:border-white/5">
                     <ZoomIn className="w-6 h-6" />
                   </button>
                   <button onClick={(e) => { e.stopPropagation(); zoomOut(); }} className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full shadow-lg flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-black/5 dark:border-white/5">
                     <ZoomOut className="w-6 h-6" />
                   </button>
                 </div>
              </>
            )}
          </TransformWrapper>
        )}
      </div>
    </div>
  );
}

function getActivePage(inst: any, numPages: number): number {
   if (!inst || !inst.wrapperComponent) return 1;
   const wrapperEl = inst.wrapperComponent;
   const wrapperRect = wrapperEl.getBoundingClientRect();
   const viewportCenter = wrapperRect.top + wrapperRect.height / 2;
   
   let closestPage = 1;
   let minDistance = Infinity;
   
   for (let i = 1; i <= numPages; i++) {
      const pageEl = document.getElementById(`pdf-page-${i}`);
      if (pageEl) {
         const rect = pageEl.getBoundingClientRect();
         if (rect.top <= viewportCenter && rect.bottom >= viewportCenter) {
            return i;
         }
         const distance = Math.abs((rect.top + rect.bottom) / 2 - viewportCenter);
         if (distance < minDistance) {
            minDistance = distance;
            closestPage = i;
         }
      }
   }
   return closestPage;
}

function FloatingScrollbar({ numPages, currentPage, setCurrentPage }: { numPages: number, currentPage: number, setCurrentPage: (p: number) => void }) {
   const { instance } = useTransformContext() as any;
   const containerRef = useRef<HTMLDivElement>(null);
   const thumbRef = useRef<HTMLDivElement>(null);
   const indicatorRef = useRef<HTMLDivElement>(null);
   const hideTimeout = useRef<any>(null);
   const isDragging = useRef(false);

   const updateState = useCallback((state: any, inst: any) => {
      if (!inst || !inst.wrapperComponent || !inst.contentComponent) return;
      
      const { scale, positionY } = state;
      const wrapperHeight = inst.wrapperComponent.offsetHeight;
      const contentHeight = inst.contentComponent.offsetHeight * scale;
      const scrollable = contentHeight - wrapperHeight;
      
      if (scrollable <= 0) {
         if (containerRef.current) {
            containerRef.current.style.opacity = '0';
            containerRef.current.style.pointerEvents = 'none';
         }
         return;
      }
      
      const trackPadding = 16;
      const trackHeight = containerRef.current ? containerRef.current.offsetHeight - trackPadding : wrapperHeight - trackPadding;
      const minThumbHeight = 40;
      const thumbHeight = Math.max((wrapperHeight / contentHeight) * trackHeight, minThumbHeight);
      
      const progress = Math.max(0, Math.min(-positionY / scrollable, 1));
      const thumbY = progress * (trackHeight - thumbHeight) + (trackPadding / 2);
      
      if (thumbRef.current) {
         thumbRef.current.style.height = `${thumbHeight}px`;
         thumbRef.current.style.transform = `translateY(${thumbY}px)`;
      }
      
      if (indicatorRef.current) {
         let page = Math.min(Math.max(Math.floor(progress * numPages) + 1, 1), numPages);
         
         if (!isDragging.current) {
            page = getActivePage(inst, numPages);
         }
         
         indicatorRef.current.textContent = `Page ${page} / ${numPages}`;
         indicatorRef.current.style.transform = `translateY(${thumbY + thumbHeight/2 - 16}px)`;
         
         if (page !== currentPage) {
            setCurrentPage(page);
         }
         
         if (isDragging.current || (containerRef.current && containerRef.current.style.opacity === '1')) {
            indicatorRef.current.style.opacity = '1';
         } else {
            indicatorRef.current.style.opacity = '0';
         }
      }
   }, [numPages, currentPage, setCurrentPage]);

   const showScrollbar = useCallback(() => {
      if (containerRef.current) {
         containerRef.current.style.opacity = '1';
         containerRef.current.style.pointerEvents = 'auto';
      }
      if (indicatorRef.current) {
         indicatorRef.current.style.opacity = '1';
      }
      
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
      hideTimeout.current = setTimeout(() => {
         if (!isDragging.current && containerRef.current) {
            containerRef.current.style.opacity = '0';
            containerRef.current.style.pointerEvents = 'none';
         }
         if (!isDragging.current && indicatorRef.current) {
            indicatorRef.current.style.opacity = '0';
         }
      }, 1500);
   }, []);

   useTransformEffect(({ state, instance: customInstance }) => {
      if (!isDragging.current) {
         showScrollbar();
      }
      updateState(state, customInstance || instance);
   });

   useEffect(() => {
      if (instance && (instance.state || instance.transformState)) {
         const transformState = instance ? (instance.state || instance.transformState) : null;
         if (transformState) updateState(transformState, instance);
      }
      return () => {
         if (hideTimeout.current) clearTimeout(hideTimeout.current);
      };
   }, [instance, updateState]);

   const handlePointerDown = (e: React.PointerEvent) => {
       const transformState = instance ? (instance.state || instance.transformState) : null;
       if (!instance || !transformState) return;
       e.preventDefault();
       e.stopPropagation();
       e.currentTarget.setPointerCapture(e.pointerId);
       
       isDragging.current = true;
       showScrollbar();
       
       const { scale = 1, positionX = 0, positionY = 0 } = transformState;
       const wrapperHeight = instance.wrapperComponent.offsetHeight;
       const contentHeight = instance.contentComponent.offsetHeight * scale;
       let scrollable = contentHeight - wrapperHeight;
       if (scrollable <= 0) scrollable = 1;
       
       const trackPadding = 16;
       const trackHeight = containerRef.current!.offsetHeight - trackPadding;
       let thumbHeight = Math.max((wrapperHeight / contentHeight) * trackHeight, 40);
       
       const rect = containerRef.current!.getBoundingClientRect();
       const currentThumbY = (-positionY / scrollable) * (trackHeight - thumbHeight) + (trackPadding / 2);
       
       const clickYInContainer = e.clientY - rect.top;
       let grabOffsetY = thumbHeight / 2;
       
       // If click was inside the thumb bounds, offset relative to thumb
       if (clickYInContainer >= currentThumbY && clickYInContainer <= currentThumbY + thumbHeight) {
           grabOffsetY = clickYInContainer - currentThumbY;
       }

       const handleMove = (moveEvent: PointerEvent) => {
          showScrollbar();
          const y = moveEvent.clientY - rect.top - (trackPadding / 2);
          let progress = (y - grabOffsetY) / (trackHeight - thumbHeight);
          progress = Math.max(0, Math.min(progress, 1));
          
          const newPositionY = -(progress * scrollable);
          instance.setTransform(positionX, newPositionY, scale, 0);
          updateState({ scale, positionX, positionY: newPositionY }, instance);
       };
       
       const handleUp = (upEvent: PointerEvent) => {
          isDragging.current = false;
          if (containerRef.current) containerRef.current.releasePointerCapture(upEvent.pointerId);
          if (indicatorRef.current) indicatorRef.current.style.opacity = '0';
          
          window.removeEventListener('pointermove', handleMove);
          window.removeEventListener('pointerup', handleUp);
          showScrollbar();
       };
       
       window.addEventListener('pointermove', handleMove);
       window.addEventListener('pointerup', handleUp);
       
       // Force initial jump if clicked on track
       handleMove(e as any);
   };

   return (
      <div 
         ref={containerRef}
         className="absolute right-0 top-0 bottom-0 w-8 z-50 transition-opacity duration-300 flex justify-center py-2 pointer-events-none"
         style={{ opacity: 0, touchAction: 'none' }}
         onPointerDown={handlePointerDown}
      >
         <div 
            ref={thumbRef}
            className="absolute top-0 right-0 w-8 flex justify-end pr-1.5 cursor-grab active:cursor-grabbing transition-transform duration-75"
            style={{ touchAction: 'none' }}
         >
             <div className="w-1.5 sm:w-2 h-full bg-black/50 dark:bg-white/50 hover:bg-black/70 dark:hover:bg-white/70 rounded-full backdrop-blur-md shadow-sm box-border" />
         </div>
         <div 
            ref={indicatorRef}
            className="absolute right-12 bg-black/80 dark:bg-white/90 text-white dark:text-black px-3 py-1.5 rounded-full text-xs font-bold font-mono transition-opacity duration-200 shadow-xl pointer-events-none whitespace-nowrap"
            style={{ opacity: 0 }}
         />
      </div>
   );
}

function PdfPageList({ pdfDoc, numPages, baseScale, firstPageRatio, annotationMode, drawColor, annotations, updatePageAnnotations, currentPage, onClick }: any) {
   const [currentlyVisiblePages, setCurrentlyVisiblePages] = useState<Set<number>>(new Set([currentPage || 1]));
   
   useEffect(() => {
      let timeoutId: any;
      const observer = new IntersectionObserver((entries) => {
         clearTimeout(timeoutId);
         timeoutId = setTimeout(() => {
            setCurrentlyVisiblePages((prev) => {
               const next = new Set(prev);
               entries.forEach(entry => {
                  const pageNum = Number(entry.target.getAttribute('data-page-num'));
                  if (entry.isIntersecting) {
                     next.add(pageNum);
                  } else {
                     next.delete(pageNum);
                  }
               });
               if (next.size === 0 && currentPage) {
                  next.add(currentPage);
               }
               return next;
            });
         }, 80);
      }, { rootMargin: '20% 0px 20% 0px', threshold: 0.01 });

      const elements = document.querySelectorAll('.pdf-page-container');
      elements.forEach(el => observer.observe(el));
      return () => { 
         observer.disconnect(); 
         clearTimeout(timeoutId); 
      };
   }, [numPages, currentPage]);

   const renderSet = React.useMemo(() => {
      const set = new Set<number>();
      
      // 1. Add directly visible pages
      currentlyVisiblePages.forEach(p => {
         if (p >= 1 && p <= numPages) set.add(p);
      });
      
      // 2. Add current anchor page
      if (currentPage >= 1 && currentPage <= numPages) {
         set.add(currentPage);
      }
      
      // 3. Add 3-page prefetch buffer (around the visible range)
      const visibleArray = Array.from(currentlyVisiblePages).map(Number);
      const minP = Math.min(...visibleArray, currentPage || 1);
      const maxP = Math.max(...visibleArray, currentPage || 1);
      
      for (let i = Math.max(1, minP - 3); i <= Math.min(numPages, maxP + 3); i++) {
         set.add(i);
      }
      
      return set;
   }, [currentlyVisiblePages, currentPage, numPages]);

   const activeQueueRef = useRef<{
      queue: { pageNum: number; priority: number; render: () => Promise<void> }[];
      activeCount: number;
      process: () => void;
      enqueue: (pageNum: number, priority: number, render: () => Promise<void>) => () => void;
   }>({
      queue: [],
      activeCount: 0,
      process() {
         if (this.activeCount >= 1 || this.queue.length === 0) return;
         this.queue.sort((a, b) => b.priority - a.priority);
         const next = this.queue.shift();
         if (!next) return;
         this.activeCount++;
         next.render().catch(err => {
            console.error("Queue process task failed:", err);
         }).finally(() => {
            this.activeCount--;
            this.process();
         });
      },
      enqueue(pageNum, priority, render) {
         this.queue = this.queue.filter(q => q.pageNum !== pageNum);
         const task = { pageNum, priority, render };
         this.queue.push(task);
         setTimeout(() => {
            this.process();
         }, 30);
         return () => {
            this.queue = this.queue.filter(q => q !== task);
         };
      }
   });

   const enqueueRender = useCallback((pageNum: number, priority: number, render: () => Promise<void>) => {
      return activeQueueRef.current.enqueue(pageNum, priority, render);
   }, []);

   const pages = [];
   for (let i = 1; i <= numPages; i++) {
      pages.push(
         <PdfPage 
            key={i} 
            pageNum={i} 
            pdfDoc={pdfDoc} 
            baseScale={baseScale} 
            firstPageRatio={firstPageRatio} 
            isVisible={renderSet.has(i)}
            isDirectlyVisible={currentlyVisiblePages.has(i)}
            enqueueRender={enqueueRender}
            annotationMode={annotationMode}
            drawColor={drawColor}
            pageAnnotations={annotations[i] || { highlights: [], strokes: [] }}
            updatePageAnnotations={updatePageAnnotations}
            onClick={onClick}
         />
      );
   }

   return <>{pages}</>;
}

function PdfPage({ pageNum, pdfDoc, baseScale, firstPageRatio, isVisible, isDirectlyVisible, enqueueRender, annotationMode, drawColor, pageAnnotations, updatePageAnnotations, onClick }: any) {
   const canvasRef = useRef<HTMLCanvasElement>(null);
   const svgRef = useRef<SVGSVGElement>(null);
   const [pageRatio, setPageRatio] = useState(firstPageRatio);
   const [isRendered, setIsRendered] = useState(false);
   const [textItems, setTextItems] = useState<any[]>([]);
   const [pageViewport, setPageViewport] = useState<any>(null);
   
   const drawingActive = annotationMode === 'draw';
   const isDrawing = useRef(false);
   const currentStroke = useRef<Stroke | null>(null);
   const [liveStroke, setLiveStroke] = useState<Stroke | null>(null);

   useEffect(() => {
      if (!isVisible) {
         // Virtualization & Memory Cleanup
         setIsRendered(false);
         setTextItems([]);
         setPageViewport(null);
         const canvas = canvasRef.current;
         if (canvas) {
            canvas.width = 0;
            canvas.height = 0;
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, 0, 0);
         }
         return;
      }

      if (isRendered) return;

      let isActive = true;
      const priority = isDirectlyVisible ? 2 : 1;

      const renderPageTask = async () => {
         try {
            const page = await pdfDoc.getPage(pageNum);
            if (!isActive) return;

            const viewport = page.getViewport({ scale: baseScale });
            if (!isActive) return;

            setPageViewport(viewport);
            setPageRatio(viewport.width / viewport.height);

            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Mobile memory safeguard & high performance
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = viewport.width * dpr;
            canvas.height = viewport.height * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const renderContext = { canvasContext: ctx, viewport };
            await page.render(renderContext).promise;

            if (isActive) {
               setIsRendered(true);
               const textContent = await page.getTextContent();
               if (isActive) setTextItems(textContent.items);
            }
         } catch (e: any) {
            console.error(`Error rendering page ${pageNum}:`, e);
         }
      };

      const dequeue = enqueueRender(pageNum, priority, renderPageTask);

      return () => {
         isActive = false;
         dequeue();
      };
   }, [isVisible, isDirectlyVisible, pageNum, pdfDoc, baseScale, isRendered, enqueueRender]);

   const getRelativeCoordinates = (e: React.PointerEvent) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
      return { x: svgP.x, y: svgP.y };
   };

   const handlePointerDown = (e: React.PointerEvent) => {
      if (!drawingActive) return;
      isDrawing.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      const coords = getRelativeCoordinates(e);
      currentStroke.current = { points: [coords], color: drawColor, thickness: 3 };
      setLiveStroke(currentStroke.current);
   };

   const handlePointerMove = (e: React.PointerEvent) => {
      if (!isDrawing.current || !currentStroke.current) return;
      const coords = getRelativeCoordinates(e);
      currentStroke.current.points.push(coords);
      setLiveStroke({ ...currentStroke.current });
   };

   const handlePointerUp = (e: React.PointerEvent) => {
      if (!isDrawing.current || !currentStroke.current) return;
      isDrawing.current = false;
      e.currentTarget.releasePointerCapture(e.pointerId);
      const finalStroke = { ...currentStroke.current };
      updatePageAnnotations(pageNum, (prev: any) => ({
         ...prev,
         strokes: [...prev.strokes, finalStroke]
      }));
      currentStroke.current = null;
      setLiveStroke(null);
   };

   return (
      <div 
         id={`pdf-page-${pageNum}`}
         className="pdf-page-container shadow-md border border-black/5 dark:border-white/5 relative bg-white"
         data-page-num={pageNum}
         onClick={onClick}
         style={{ 
            width: '100%', 
            maxWidth: '1200px', 
            aspectRatio: String(pageRatio),
            opacity: isVisible && isRendered ? 1 : 0.4,
            transition: 'opacity 0.3s ease',
            touchAction: annotationMode !== 'none' ? 'none' : 'auto'
         }}
      >
         <canvas ref={canvasRef} className="w-full h-full block absolute inset-0 z-0" />
         
         <div className="absolute inset-0 z-10 w-full h-full overflow-hidden" style={{ pointerEvents: annotationMode === 'none' ? 'auto' : 'none' }}>
            {isRendered && pageViewport && textItems.map((item, id) => {
               if (!item.str) return null;
               const tx = item.transform;
               const fontHeight = Math.sqrt((tx[2] * tx[2]) + (tx[3] * tx[3])) * baseScale;
               const fontSize = fontHeight;
               const left = tx[4] * baseScale;
               const top = pageViewport.height - (tx[5] * baseScale) - fontSize;
               
               return (
                  <span 
                     key={id}
                     style={{
                        position: 'absolute',
                        left: `${left}px`,
                        top: `${top}px`,
                        fontSize: `${fontSize}px`,
                        color: 'transparent',
                        cursor: 'text',
                        whiteSpace: 'pre',
                        transform: `scaleX(${tx[0] / fontHeight})`,
                        transformOrigin: 'left bottom'
                     }}
                     className="selection:bg-indigo-300/40" 
                  >
                     {item.str}
                  </span>
               )
            })}
         </div>

         <svg 
            ref={svgRef}
            className="absolute inset-0 z-20 w-full h-full" 
            style={{ pointerEvents: annotationMode === 'draw' ? 'auto' : 'none' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
         >
            {pageAnnotations.strokes.map((stroke: Stroke, idx: number) => {
               const d = stroke.points.map((p, i) => `${i===0?'M':'L'} ${p.x} ${p.y}`).join(' ');
               return <path key={idx} d={d} stroke={stroke.color} strokeWidth={stroke.thickness} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            })}
            {liveStroke && liveStroke.points.length > 0 && (
               <path 
                  d={liveStroke.points.map((p, i) => `${i===0?'M':'L'} ${p.x} ${p.y}`).join(' ')} 
                  stroke={liveStroke.color} 
                  strokeWidth={liveStroke.thickness} 
                  fill="none" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
               />
            )}
         </svg>
         
         {(!isRendered || !isVisible) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
               <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-400" />
               <span className="text-sm font-semibold uppercase tracking-wider">Loading Page {pageNum}</span>
            </div>
         )}
      </div>
   );
}
