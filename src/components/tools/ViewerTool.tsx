import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
    UploadCloud, BookOpen, X, ZoomIn, ZoomOut, Loader2, Maximize, Minimize, 
    Download, PenTool, Search, List, PanelLeftClose, PanelLeftOpen, LayoutGrid, LayoutTemplate, Moon, Sun, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Type, Edit3, Wrench
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-expect-error
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { downloadBlob } from '../../lib/utils';
import { useInView } from 'react-intersection-observer';
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
  onSaveDrawing,
  darkMode,
  viewMode,
  editTextMode,
  onTextEdit
}: { 
  pageNumber: number; 
  pdfDoc: any; 
  scale: number; 
  drawMode: boolean;
  drawTool: 'pencil' | 'marker' | 'highlighter' | 'eraser';
  strokeSize: number;
  onSaveDrawing: (pageNum: number, canvas: HTMLCanvasElement) => void;
  darkMode: boolean;
  viewMode: 'continuous' | 'single';
  editTextMode: boolean;
  onTextEdit: (pageNum: number, index: number, updatedItem: any) => void;
}) {
  const { ref, inView } = useInView({ rootMargin: '800px 0px' });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 600, height: 800 });
  const [textItems, setTextItems] = useState<any[]>([]);

  useEffect(() => {
    let isCancelled = false;
    if (pdfDoc) {
      pdfDoc.getPage(pageNumber).then((page: any) => {
        if (isCancelled) return;
        const viewport = page.getViewport({ scale });
        setViewportSize({ width: viewport.width, height: viewport.height });
      }).catch(console.error);
    }
    return () => { isCancelled = true; };
  }, [pdfDoc, pageNumber, scale]);

  useEffect(() => {
    let isCancelled = false;
    let renderTask: any;
    if (pdfDoc && canvasRef.current && inView) {
      pdfDoc.getPage(pageNumber).then((page: any) => {
        if (isCancelled) return;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        if (drawCanvasRef.current && drawCanvasRef.current.width !== viewport.width) {
          drawCanvasRef.current.width = viewport.width;
          drawCanvasRef.current.height = viewport.height;
        }

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

        renderTask = page.render({ canvasContext: ctx, viewport, transform } as any);
        renderTask.promise.then(() => {
          if (!isCancelled) setRendered(true);
        }).catch((e: any) => {
          if (e.name !== 'RenderingCancelledException' && !e.message?.includes('Rendering cancelled')) {
            console.error('Render error', e);
          }
        });

        // Always extract text for selection or editing
        page.getTextContent().then((content: any) => {
          if (isCancelled) return;
          const items = content.items.filter((i: any) => 'str' in i);
          
          items.sort((a: any, b: any) => {
             if (Math.abs(b.transform[5] - a.transform[5]) > 5) return b.transform[5] - a.transform[5];
             return a.transform[4] - b.transform[4];
          });

          const blocks: any[] = [];
          let currentBlock: any = null;

          items.forEach((item: any, idx: number) => {
             if (item.str.trim() === '') {
               if (currentBlock) currentBlock.text += item.str;
               return;
             }
             const y = item.transform[5];
             const x = item.transform[4];
             const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
             const fontHeight = Math.sqrt((tx[2] * tx[2]) + (tx[3] * tx[3]));
             
             if (!currentBlock) {
                currentBlock = { id: idx, text: item.str, originalItems: [item], fontHeight, tx, width: item.width * scale };
             } else {
                const prevItem = currentBlock.originalItems[currentBlock.originalItems.length - 1];
                const prevY = prevItem.transform[5];
                const prevX = prevItem.transform[4];
                const prevWidth = prevItem.width;

                const sameLine = Math.abs(prevY - y) < 5;
                const nextLine = !sameLine && (prevY - y) > 0 && (prevY - y) < (currentBlock.fontHeight / scale) * 2.5;
                
                if (sameLine) {
                   const space = x - (prevX + prevWidth);
                   if (space > 5) currentBlock.text += ' ';
                   currentBlock.text += item.str;
                   currentBlock.originalItems.push(item);
                   currentBlock.width = Math.max(currentBlock.width, (x - currentBlock.originalItems[0].transform[4] + item.width) * scale);
                } else if (nextLine) {
                   currentBlock.text += '\n' + item.str;
                   currentBlock.originalItems.push(item);
                   currentBlock.width = Math.max(currentBlock.width, item.width * scale);
                } else {
                   blocks.push(currentBlock);
                   currentBlock = { id: idx, text: item.str, originalItems: [item], fontHeight, tx, width: item.width * scale };
                }
             }
          });
          if (currentBlock) blocks.push(currentBlock);

          const mapped = blocks.map((block: any) => {
             return {
                id: block.id,
                originalItems: block.originalItems,
                text: block.text,
                style: {
                   left: `${block.tx[4]}px`,
                   top: `${block.tx[5] - block.fontHeight}px`,
                   fontSize: `${block.fontHeight}px`,
                   position: 'absolute' as const,
                   fontFamily: block.originalItems[0].fontName || 'sans-serif',
                   whiteSpace: 'pre-wrap' as const,
                   lineHeight: 1.2,
                   transform: 'scaleY(1)',
                   minWidth: `${block.width}px`
                }
             };
          });
          setTextItems(mapped);
        }).catch(console.error);
      }).catch((e: any) => {
        if (e.name !== 'RenderingCancelledException' && !e.message?.includes('Rendering cancelled')) {
          console.error('Get page error', e);
        }
      });
    }
    return () => {
      isCancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch (e) {}
      }
    }
  }, [pdfDoc, pageNumber, scale, inView, editTextMode]);

  const handleEditBlur = (itemIndex: number, newStr: string) => {
     if (!newStr.trim()) return;
     const item = textItems.find(i => i.id === itemIndex);
     if (item && item.text !== newStr) {
        const updated = { ...item, text: newStr };
        setTextItems(prev => prev.map(i => i.id === itemIndex ? updated : i));
        onTextEdit(pageNumber, itemIndex, updated);
     }
  };

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
      ctx.strokeStyle = '#1e293b'; 
      ctx.globalCompositeOperation = 'source-over';
    } else if (drawTool === 'marker') {
      ctx.strokeStyle = '#ef4444'; 
      ctx.globalCompositeOperation = 'source-over';
    } else if (drawTool === 'highlighter') {
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.05)'; 
      ctx.globalCompositeOperation = 'multiply';
      ctx.lineWidth = strokeSize * 2;
    } else if (drawTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
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

  // Dark mode standard filter approach
  const filterStyle = darkMode ? 'invert(1) hue-rotate(180deg) contrast(1.1)' : 'none';

  return (
    <div 
       ref={ref} 
       id={`pdf-page-${pageNumber}`} 
       className={`relative bg-white shadow-xl mx-auto flex-shrink-0`} 
       style={{ width: `${viewportSize.width}px`, height: `${viewportSize.height}px`, filter: filterStyle, marginBottom: viewMode === 'continuous' ? '0px' : '20px' }}
    >
      {!rendered && inView && (
        <div className="absolute inset-0 bg-slate-50 flex items-center justify-center">
           <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      )}
      <canvas ref={canvasRef} className={`w-full h-full align-top ${editTextMode ? 'pointer-events-none opacity-50' : ''}`} style={{ transition: 'opacity 0.2s' }} />
      <canvas 
        ref={drawCanvasRef}
        className={`absolute top-0 left-0 w-full h-full align-top ${drawMode ? 'cursor-crosshair z-20 touch-none' : 'pointer-events-none'}`}
        onMouseDown={startDrawing}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        onMouseMove={draw}
        onTouchStart={startDrawing}
        onTouchEnd={stopDrawing}
        onTouchMove={draw}
      />
      
      {!drawMode && textItems.length > 0 && (
        <div className={`absolute inset-0 overflow-hidden ${editTextMode ? 'z-30 pointer-events-none' : 'z-10'}`}>
          {textItems.map((item) => (
            <div
              key={item.id}
              contentEditable={editTextMode}
              suppressContentEditableWarning
              onBlur={(e) => handleEditBlur(item.id, e.target.innerText)}
              className={`${editTextMode ? 'pointer-events-auto bg-white hover:outline hover:outline-1 hover:outline-indigo-500 focus:outline focus:outline-2 focus:outline-indigo-500 focus:z-40 text-black' : 'text-transparent bg-transparent pointer-events-auto cursor-text selection:bg-indigo-500/30'}`}
              style={{
                 ...item.style,
                 color: editTextMode ? '#000' : 'transparent',
                 caretColor: '#000'
              }}
            >
              {item.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Thumbnail({ pageNumber, pdfDoc, isActive, onClick }: any) {
  const { ref, inView } = useInView({ rootMargin: '200px 0px' });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    let isCancelled = false;
    let renderTask: any;
    if (pdfDoc && canvasRef.current && inView) {
      pdfDoc.getPage(pageNumber).then((page: any) => {
        if (isCancelled) return;
        const viewport = page.getViewport({ scale: 0.2 });
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = viewport.width * outputScale;
        canvas.height = viewport.height * outputScale;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        ctx.setTransform(outputScale, 0, 0, outputScale, 0, 0);
        renderTask = page.render({ canvasContext: ctx, viewport, transform: [outputScale, 0, 0, outputScale, 0, 0] } as any);
        renderTask.promise.catch((e: any) => {
          if (e.name !== 'RenderingCancelledException' && !e.message?.includes('Rendering cancelled')) {
             console.error('Thumbnail render error:', e);
          }
        });
      }).catch((e: any) => {
          if (e.name !== 'RenderingCancelledException' && !e.message?.includes('Rendering cancelled')) {
             console.error('Thumbnail page error:', e);
          }
      });
    }
    return () => {
      isCancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch (e) {}
      }
    }
  }, [pdfDoc, pageNumber, inView]);

  return (
    <div 
      ref={ref} 
      onClick={onClick} 
      className={`w-full flex-col flex items-center mb-4 cursor-pointer transition-all p-2 rounded-lg ${isActive ? 'bg-indigo-100 dark:bg-indigo-900/50 outline outline-2 outline-indigo-500' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
    >
      <div className="relative w-full aspect-[1/1.4] bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm rounded overflow-hidden">
        <canvas ref={canvasRef} className="max-w-full h-auto bg-white rounded relative z-0 pointer-events-none" />
      </div>
      <span className={`text-xs font-bold mt-2 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>{pageNumber}</span>
    </div>
  );
}

export function ViewerTool() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  const [baseScale, setBaseScale] = useState<number>(1.0);
  const [zoomFactor, setZoomFactor] = useState<number>(1.0);
  const pdfScale = baseScale * zoomFactor;

  const [isPanning, setIsPanning] = useState(false);
  const panningRef = useRef({ isDown: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (drawMode || zoomFactor <= 1.0 || e.button !== 0) return;
    panningRef.current = {
      isDown: true,
      startX: e.pageX - (scrollAreaRef.current?.offsetLeft || 0),
      startY: e.pageY - (scrollAreaRef.current?.offsetTop || 0),
      scrollLeft: scrollAreaRef.current?.scrollLeft || 0,
      scrollTop: scrollAreaRef.current?.scrollTop || 0
    };
    setIsPanning(true);
  };

  const handleMouseUpOrLeave = () => {
    panningRef.current.isDown = false;
    setIsPanning(false);
  };

  const handleScroll = () => {
    if (viewMode !== 'continuous' || !scrollAreaRef.current) return;
    const parentTop = scrollAreaRef.current.scrollTop;
    const parentHeight = scrollAreaRef.current.clientHeight;
    const center = parentTop + parentHeight / 2;

    let closestPage = currentPage;
    let minDiff = Infinity;

    // A simple heuristic checking a few pages around the current one
    const start = Math.max(1, currentPage - 5);
    const end = Math.min(pdfDoc?.numPages || 1, currentPage + 5);

    for (let i = start; i <= end; i++) {
        const el = document.getElementById(`pdf-page-${i}`);
        if (el) {
            const elCenter = el.offsetTop + el.clientHeight / 2;
            const diff = Math.abs(elCenter - center);
            if (diff < minDiff) {
                minDiff = diff;
                closestPage = i;
            }
        }
    }
    
    if (closestPage !== currentPage) {
        setCurrentPage(closestPage);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!panningRef.current.isDown || drawMode || !scrollAreaRef.current) return;
    e.preventDefault();
    const x = e.pageX - (scrollAreaRef.current.offsetLeft || 0);
    const y = e.pageY - (scrollAreaRef.current.offsetTop || 0);
    const walkX = (x - panningRef.current.startX);
    const walkY = (y - panningRef.current.startY);
    scrollAreaRef.current.scrollLeft = panningRef.current.scrollLeft - walkX;
    scrollAreaRef.current.scrollTop = panningRef.current.scrollTop - walkY;
  };

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mode, setMode] = useState<'view' | 'draw' | 'editText'>('view');
  const drawMode = mode === 'draw';
  const editTextMode = mode === 'editText';
  const [drawTool, setDrawTool] = useState<'pencil' | 'marker' | 'highlighter' | 'eraser'>('pencil');
  const [strokeSize, setStrokeSize] = useState(3);
  const [hasEdited, setHasEdited] = useState(false);
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'thumbnails' | 'outline' | 'search' | 'tools'>('thumbnails');
  const [darkMode, setDarkMode] = useState(false);
  const [viewMode, setViewMode] = useState<'continuous' | 'single'>('continuous');
  const [currentPage, setCurrentPage] = useState(1);
  
  const [outline, setOutline] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const drawingsRef = useRef<Map<number, string>>(new Map());
  const editedTextsRef = useRef<Map<number, Map<number, any>>>(new Map());

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const f = acceptedFiles[0];
      setFile(f);
      setFileName(f.name);
      setIsLoading(true);
      setHasEdited(false);
      drawingsRef.current.clear();
      editedTextsRef.current.clear();
      setSearchQuery('');
      setSearchResults([]);
      setOutline([]);
      setCurrentPage(1);
      
      try {
        const arrayBuffer = await f.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        setPdfDoc(pdf);
        const out = await pdf.getOutline();
        setOutline(out || []);
        if (window.innerWidth < 768) setSidebarOpen(false);

        // Fit width bounds calculation
        if (scrollAreaRef.current) {
           scrollAreaRef.current.scrollTop = 0;
           scrollAreaRef.current.scrollLeft = 0;
           const page1 = await pdf.getPage(1);
           const vp = page1.getViewport({ scale: 1.0 });
           const containerWidth = scrollAreaRef.current.clientWidth || window.innerWidth;
           const pageWidth = vp.width;
           const newBaseScale = (containerWidth - 32) / pageWidth; // slight margin
           setBaseScale(newBaseScale);
        } else {
           setBaseScale(window.innerWidth < 768 ? 0.6 : 1.0);
        }
        setZoomFactor(1.0);
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
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleSaveDrawing = (pageNum: number, canvas: HTMLCanvasElement) => {
    drawingsRef.current.set(pageNum, canvas.toDataURL('image/png'));
    setHasEdited(true);
  };

  const handleTextEdit = (pageNum: number, itemIndex: number, updatedItem: any) => {
    if (!editedTextsRef.current.has(pageNum)) {
       editedTextsRef.current.set(pageNum, new Map());
    }
    editedTextsRef.current.get(pageNum)!.set(itemIndex, updatedItem);
    setHasEdited(true);
  };

  const handleSaveEditedPdf = async () => {
    if (!file) return;
    setIsLoading(true);
    try {
      const fileBytes = await file.arrayBuffer();
      const pdf = await PDFDocument.load(fileBytes);
      const pages = pdf.getPages();

      // Embed drawings
      const entries = Array.from(drawingsRef.current.entries()) as [number, string][];
      for (const [pageNum, dataUrl] of entries) {
        const signatureBytes = await fetch(dataUrl).then(res => res.arrayBuffer());
        const pngImage = await pdf.embedPng(signatureBytes);
        const pageIndex = pageNum - 1;
        if (pages[pageIndex]) {
          const page = pages[pageIndex];
          const { width, height } = page.getSize();
          page.drawImage(pngImage, { x: 0, y: 0, width: width, height: height });
        }
      }

      // Embed texts
      const textFont = await pdf.embedFont(StandardFonts.Helvetica);
      const textEntries = Array.from(editedTextsRef.current.entries());
      for (const [pageNum, itemsMap] of textEntries) {
          const pageIndex = pageNum - 1;
          if (pages[pageIndex]) {
             const page = pages[pageIndex];
             for (const [_, updatedItem] of Array.from(itemsMap.entries())) {
                const originalItem = updatedItem.originalItem;
                const newText = updatedItem.text;
                if (!originalItem) continue;

                // For PDF.js, item.transform is [scaleX, skewY, skewX, scaleY, tx, ty]
                // and it's in unscaled, standard PDF coordinates where (0,0) is bottom left.
                const tx = originalItem.transform;
                const fontSize = Math.sqrt(tx[2]*tx[2] + tx[3]*tx[3]) || tx[0]; // fallback
                const x = tx[4];
                const y = tx[5];

                // Attempt to "white out" the original text
                page.drawRectangle({
                    x: x,
                    y: y - (fontSize * 0.2), // baseline offset
                    width: originalItem.width,
                    height: originalItem.height,
                    color: rgb(1, 1, 1),
                });
                
                page.drawText(newText, {
                    x: x,
                    y: y,
                    size: fontSize,
                    font: textFont,
                    color: rgb(0, 0, 0),
                });
             }
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

  const jumpToPage = (pageNum: number) => {
    setCurrentPage(pageNum);
    if (viewMode === 'continuous') {
      const el = document.getElementById(`pdf-page-${pageNum}`);
      if (el && scrollAreaRef.current) {
        scrollAreaRef.current.scrollTo({ top: el.offsetTop, behavior: 'auto' });
      }
    }
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const performSearch = async () => {
    if (!pdfDoc || !searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    const res = [];
    const query = searchQuery.toLowerCase();
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      try {
        const page = await pdfDoc.getPage(i);
        const content = await page.getTextContent();
        const text = content.items.map((it: any) => it.str).join(' ');
        const index = text.toLowerCase().indexOf(query);
        if (index > -1) {
          const snippet = text.substring(Math.max(0, index - 30), Math.min(text.length, index + query.length + 30));
          res.push({ pageIndex: i, snippet });
        }
      } catch (e) {}
      if (i % 5 === 0) {
        setSearchResults([...res]); // update incrementally
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    setSearchResults(res);
    setIsSearching(false);
  };

  const RenderOutline = ({ items }: { items: any[] }) => {
    if (!items || items.length === 0) return null;
    return (
      <ul className="pl-4 space-y-2 mt-2">
        {items.map((item, idx) => (
          <li key={idx} className="text-sm">
            <button 
               className="text-left hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors w-full line-clamp-2"
               onClick={async () => {
                 if (item.dest) {
                   const destObj = typeof item.dest === 'string' ? await pdfDoc.getDestination(item.dest) : item.dest;
                   if (destObj) {
                     const pageIndex = await pdfDoc.getPageIndex(destObj[0]);
                     jumpToPage(pageIndex + 1);
                   }
                 }
               }}
            >
              {item.title}
            </button>
            {item.items && item.items.length > 0 && <RenderOutline items={item.items} />}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className={`flex-1 flex flex-col ${isFullscreen ? '' : 'pt-4 animate-in fade-in slide-in-from-bottom-4 duration-300'} min-h-full`}>
      <div 
        ref={containerRef}
        className={`bg-white dark:bg-slate-950 flex flex-col flex-1 overflow-hidden transition-colors ${isFullscreen ? 'rounded-none' : 'rounded-[24px] shadow-sm border border-slate-200 dark:border-slate-800'}`}
      >
        {!pdfDoc && !isLoading ? (
          <div className="p-10 flex flex-col items-center justify-center min-h-[600px] text-center flex-1">
             <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-[24px] text-indigo-500 flex items-center justify-center mb-6 ring-1 ring-indigo-500/20">
               <BookOpen className="w-10 h-10" />
             </div>
             <h2 className="text-3xl font-bold text-slate-800 dark:text-white">PDF Viewer</h2>
             <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md mb-8">View, search, and navigate your PDF documents quickly securely.</p>
             
             <div 
               {...getRootProps()} 
               className={`w-full max-w-xl mx-auto rounded-[24px] p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${
                 isDragActive ? 'scale-[1.02] bg-indigo-50 border-indigo-400' : 'hover:bg-slate-50 dark:hover:bg-slate-900 border-dashed border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950'
               }`}
             >
               <input {...getInputProps()} />
               <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                  <UploadCloud className="w-8 h-8 text-indigo-500 dark:text-indigo-400" />
               </div>
               <p className="text-lg font-bold text-slate-700 dark:text-slate-200">Open a PDF file</p>
               <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">Drag and drop or click to browse</p>
             </div>
          </div>
        ) : isLoading && !pdfDoc ? (
           <div className="p-10 flex flex-col items-center justify-center min-h-[600px] text-center flex-1">
             <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
             <p className="text-lg font-bold text-slate-700 dark:text-slate-300">Loading document...</p>
           </div>
        ) : (
          <div className="flex flex-col flex-1 relative overflow-hidden h-full">
            {/* Toolbar */}
            <div className="min-h-[56px] shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-wrap items-center justify-between px-2 sm:px-4 py-2 gap-y-2 z-40 transition-colors" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top, 12px))' }}>
              <div className="flex items-center gap-2 sm:gap-3">
                <button 
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className={`flex items-center justify-center p-2 min-w-[44px] min-h-[44px] rounded-lg transition-colors ${sidebarOpen ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30' : 'hover:bg-slate-100 text-slate-600 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                  style={{ touchAction: 'manipulation' }}
                  title="Toggle Sidebar"
                >
                  {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
                </button>
                <div className="flex items-center gap-2 px-2 border-r border-slate-200 dark:border-slate-800">
                  <BookOpen className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                  <span className="font-bold text-slate-800 dark:text-white truncate max-w-[120px] md:max-w-[200px]">{fileName}</span>
                </div>
              </div>
              
              <div className="flex items-center flex-wrap justify-end gap-2">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg gap-1">
                  <button onClick={() => setViewMode('continuous')} className={`p-2.5 sm:p-1.5 rounded-md transition-colors ${viewMode === 'continuous' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`} title="Continuous Scroll"><LayoutGrid className="w-5 h-5 sm:w-4 sm:h-4" /></button>
                  <button onClick={() => setViewMode('single')} className={`p-2.5 sm:p-1.5 rounded-md transition-colors ${viewMode === 'single' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`} title="Single Page"><LayoutTemplate className="w-5 h-5 sm:w-4 sm:h-4" /></button>
                </div>
                
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg items-center gap-1">
                  <button onClick={() => setZoomFactor(s => Math.max(1.0, s - 0.25))} className="p-2.5 sm:p-1.5 text-slate-600 hover:text-indigo-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"><ZoomOut className="w-5 h-5 sm:w-4 sm:h-4" /></button>
                  <span className="text-sm font-mono font-bold w-12 text-center text-slate-700 dark:text-slate-200">{Math.round(zoomFactor * 100)}%</span>
                  <button onClick={() => setZoomFactor(s => Math.min(5.0, s + 0.25))} className="p-2.5 sm:p-1.5 text-slate-600 hover:text-indigo-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"><ZoomIn className="w-5 h-5 sm:w-4 sm:h-4" /></button>
                </div>

                <button 
                   onClick={() => setDarkMode(!darkMode)}
                   className={`p-2.5 rounded-lg transition-colors ${darkMode ? 'bg-slate-800 text-yellow-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                   title="Dark Mode"
                >
                   {darkMode ? <Sun className="w-6 h-6 sm:w-5 sm:h-5" /> : <Moon className="w-6 h-6 sm:w-5 sm:h-5" />}
                </button>

                <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block"></div>

                <button onClick={toggleFullscreen} className="block p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg sm:ml-1">
                  {isFullscreen ? <Minimize className="w-6 h-6 sm:w-5 sm:h-5" /> : <Maximize className="w-6 h-6 sm:w-5 sm:h-5" />}
                </button>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden bg-slate-200/50 dark:bg-slate-900/50 relative transition-colors">
              
              {/* Sidebar */}
              <div 
                className={`flex flex-col bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 overflow-hidden transition-all duration-300 ease-in-out absolute md:relative z-30 h-full ${sidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full md:w-0 md:translate-x-0 opacity-0'}`}
              >
                <div className="flex border-b border-slate-100 dark:border-slate-800">
                  <button onClick={() => setSidebarTab('thumbnails')} className={`flex-1 p-3 flex justify-center border-b-2 transition-colors ${sidebarTab === 'thumbnails' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`} title="Thumbnails"><LayoutGrid className="w-5 h-5" /></button>
                  <button onClick={() => setSidebarTab('outline')} className={`flex-1 p-3 flex justify-center border-b-2 transition-colors ${sidebarTab === 'outline' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`} title="Outline"><List className="w-5 h-5" /></button>
                  <button onClick={() => setSidebarTab('search')} className={`flex-1 p-3 flex justify-center border-b-2 transition-colors ${sidebarTab === 'search' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`} title="Search"><Search className="w-5 h-5" /></button>
                  <button onClick={() => setSidebarTab('tools')} className={`flex-1 p-3 flex justify-center border-b-2 transition-colors ${sidebarTab === 'tools' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`} title="Tools"><Wrench className="w-5 h-5" /></button>
                </div>
                <div className="flex-1 overflow-y-auto overscroll-contain p-4 custom-scrollbar">
                  {sidebarTab === 'tools' && (
                    <div className="flex flex-col gap-3">
                      <button 
                        className={`flex items-center gap-2 p-3 min-h-[44px] rounded-lg font-bold transition-all ${mode === 'view' ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`} 
                        onClick={() => { setMode('view'); if (window.innerWidth < 768) setSidebarOpen(false); }}
                      >
                         <BookOpen className="w-5 h-5" /> View Mode
                      </button>

                      <button 
                        className={`flex items-center gap-2 p-3 min-h-[44px] rounded-lg font-bold transition-all ${mode === 'draw' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`} 
                        onClick={() => { setMode('draw'); if (window.innerWidth < 768) setSidebarOpen(false); }}
                      >
                        <PenTool className="w-5 h-5" /> Draw
                      </button>
                      
                      {mode === 'draw' && (
                        <div className="flex flex-col gap-2 pl-4 py-2 border-l-2 border-slate-100 dark:border-slate-800 ml-2">
                           <label className="text-xs font-bold text-slate-500 uppercase">Tool</label>
                           <select value={drawTool} onChange={e => setDrawTool(e.target.value as any)} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm font-bold outline-none cursor-pointer">
                             <option value="pencil">Pencil</option>
                             <option value="marker">Marker</option>
                             <option value="highlighter">Highlighter</option>
                             <option value="eraser">Eraser</option>
                           </select>
                           
                           <label className="text-xs font-bold text-slate-500 uppercase mt-2">Size: {strokeSize}px</label>
                           <input type="range" min="1" max="20" value={strokeSize} onChange={e => setStrokeSize(parseInt(e.target.value))} className="w-full cursor-pointer" />
                        </div>
                      )}

                      <button 
                        className={`flex items-center gap-2 p-3 min-h-[44px] rounded-lg font-bold transition-all ${mode === 'editText' ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`} 
                        onClick={() => { setMode('editText'); if (window.innerWidth < 768) setSidebarOpen(false); }}
                      >
                        <Edit3 className="w-5 h-5" /> Edit Text
                      </button>
                      
                      {hasEdited && (
                         <button onClick={handleSaveEditedPdf} className="flex items-center justify-center gap-2 mt-4 p-3 min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-colors">
                            <Download className="w-5 h-5" /> Save Changes
                         </button>
                      )}
                    </div>
                  )}
                  {sidebarTab === 'thumbnails' && (
                    <div className="flex flex-col">
                      {Array.from({ length: pdfDoc.numPages }).map((_, i) => (
                        <Thumbnail key={i} pageNumber={i + 1} pdfDoc={pdfDoc} isActive={currentPage === i + 1} onClick={() => jumpToPage(i + 1)} />
                      ))}
                    </div>
                  )}
                  {sidebarTab === 'outline' && (
                    <div>
                      {outline.length > 0 ? <RenderOutline items={outline} /> : <p className="text-slate-500 text-sm text-center mt-10">No outline available.</p>}
                    </div>
                  )}
                  {sidebarTab === 'search' && (
                    <div className="flex flex-col gap-4">
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && performSearch()}
                          placeholder="Search text..." 
                          className="flex-1 bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                        <button onClick={performSearch} disabled={isSearching} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                          {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="flex flex-col gap-2">
                        {searchResults.map((res, i) => (
                          <button key={i} onClick={() => jumpToPage(res.pageIndex)} className="text-left p-3 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg text-sm transition-colors border border-slate-100 dark:border-slate-700">
                            <span className="font-bold text-indigo-600 dark:text-indigo-400 block mb-1">Page {res.pageIndex}</span>
                            <span className="text-slate-600 dark:text-slate-300">...{res.snippet}...</span>
                          </button>
                        ))}
                        {!isSearching && searchQuery && searchResults.length === 0 && <p className="text-slate-500 text-sm text-center">No results found.</p>}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* PDF Canvas Area */}
              <div 
                ref={scrollAreaRef}
                className={`flex-1 overflow-y-auto overflow-x-auto relative transition-colors overscroll-contain flex flex-col ${darkMode ? 'bg-slate-900' : 'bg-slate-200/60'}`}
                onScroll={handleScroll}
              >
                {/* Backdrop for single click to close sidebar on mobile */}
                {sidebarOpen && <div className="absolute inset-0 z-20 bg-black/10 md:hidden" onClick={() => setSidebarOpen(false)}></div>}
                
                <TransformWrapper 
                    initialScale={1} 
                    minScale={1} 
                    maxScale={4} 
                    limitToBounds={true}
                    centerOnInit={true}
                    disabled={mode === 'draw' || mode === 'editText'}
                    panning={{ disabled: mode === 'draw' || mode === 'editText' }}
                    wheel={{ disabled: mode === 'draw' || mode === 'editText' }}
                >
                   <TransformComponent wrapperClass="!w-full !h-full flex-1" contentClass="!min-w-max mx-auto flex flex-col items-center">
                    <div className={`w-full min-w-max mx-auto flex flex-col items-center py-4 ${viewMode === 'continuous' ? '' : 'p-4 md:p-8'}`}>
                       {viewMode === 'continuous' ? (
                         Array.from({ length: pdfDoc.numPages }).map((_, i) => (
                           <PdfPage 
                             key={i}
                             pageNumber={i + 1} 
                             pdfDoc={pdfDoc} 
                             scale={pdfScale} 
                             drawMode={drawMode}
                             drawTool={drawTool}
                             strokeSize={strokeSize}
                             onSaveDrawing={handleSaveDrawing}
                             darkMode={darkMode}
                             viewMode={viewMode}
                             editTextMode={editTextMode}
                             onTextEdit={handleTextEdit}
                           />
                         ))
                      ) : (
                         <div className="flex flex-col items-center relative gap-6 pb-20">
                           <PdfPage 
                             pageNumber={currentPage} 
                             pdfDoc={pdfDoc} 
                             scale={pdfScale} 
                             drawMode={drawMode}
                             drawTool={drawTool}
                             strokeSize={strokeSize}
                             onSaveDrawing={handleSaveDrawing}
                             darkMode={darkMode}
                             viewMode={viewMode}
                             editTextMode={editTextMode}
                             onTextEdit={handleTextEdit}
                           />
                         </div>
                      )}
                    </div>
                   </TransformComponent>
                </TransformWrapper>
              </div>

            </div>

            {/* Single Page Navigation Overlay */}
            {viewMode === 'single' && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center justify-center gap-2 flex-nowrap bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg border border-slate-200 dark:border-slate-800 z-40">
                <button onClick={() => jumpToPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} className="p-1 min-h-[36px] min-w-[36px] flex items-center justify-center text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full disabled:opacity-30 flex-shrink-0">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-1 text-sm font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap leading-none">
                  <input type="number" min={1} max={pdfDoc?.numPages || 1} value={currentPage} onChange={e => jumpToPage(parseInt(e.target.value) || 1)} className="w-10 text-center bg-transparent border-b border-slate-300 dark:border-slate-600 focus:border-indigo-500 outline-none" />
                  <span>/ {pdfDoc?.numPages || 1}</span>
                </div>
                <button onClick={() => jumpToPage(Math.min(pdfDoc?.numPages || 1, currentPage + 1))} disabled={currentPage >= (pdfDoc?.numPages || 1)} className="p-1 min-h-[36px] min-w-[36px] flex items-center justify-center text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full disabled:opacity-30 flex-shrink-0">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Draw Mode Tool floating bar */}
            {drawMode && (
              <div className="sm:hidden absolute bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-xl shadow-lg border border-rose-200 z-40">
                <select value={drawTool} onChange={e => setDrawTool(e.target.value as any)} className="bg-transparent text-sm font-bold outline-none cursor-pointer">
                  <option value="pencil">Pencil</option>
                  <option value="marker">Marker</option>
                  <option value="highlighter">Highlight</option>
                  <option value="eraser">Eraser</option>
                </select>
                <div className="w-px h-4 bg-slate-300"></div>
                <select value={strokeSize} onChange={e => setStrokeSize(parseInt(e.target.value))} className="bg-transparent text-sm font-bold outline-none cursor-pointer">
                  <option value={1}>Fine</option>
                  <option value={3}>Med</option>
                  <option value={6}>Thick</option>
                  <option value={10}>Jumbo</option>
                </select>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
