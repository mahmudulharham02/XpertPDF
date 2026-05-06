'use client';
 
import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  Menu,
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Moon,
  Sun,
  Download,
  Search,
  Highlighter,
  Pen,
  MessageSquare,
  Trash2,
  ChevronUp,
  Home,
} from 'lucide-react';
 
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
 
interface Annotation {
  id: string;
  type: 'highlight' | 'note' | 'draw';
  pageNum: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  content?: string;
  points?: Array<{ x: number; y: number }>;
}
 
interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  scrollLeft: number;
  scrollTop: number;
}
 
const MobileWebtoonPDFViewer: React.FC<{ pdfUrl: string; title?: string }> = ({
  pdfUrl,
  title = 'PDF Viewer',
}) => {
  // State
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ pageNum: number; text: string }>>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annotationMode, setAnnotationMode] = useState<'none' | 'highlight' | 'draw' | 'note'>('none');
  const [highlightColor, setHighlightColor] = useState('#FFFF00');
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawPoints, setCurrentDrawPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [showTopBar, setShowTopBar] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
 
  // Refs
  const pdfDocRef = useRef<pdfjsLib.PDFDocument | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const annotationCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const dragStateRef = useRef<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });
  const renderedPagesRef = useRef<Set<number>>(new Set());
 
  // Load PDF
  useEffect(() => {
    const loadPDF = async () => {
      try {
        setIsLoading(true);
        const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
        pdfDocRef.current = pdf;
        setTotalPages(pdf.numPages);
        // Render visible pages after a short delay
        setTimeout(() => renderVisiblePages(), 100);
      } catch (err) {
        setError(`Failed to load PDF: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    };
 
    loadPDF();
  }, [pdfUrl]);
 
  // Render page on canvas
  const renderPage = useCallback(
    async (pageNum: number, canvas: HTMLCanvasElement) => {
      if (!pdfDocRef.current || renderedPagesRef.current.has(pageNum)) return;
 
      try {
        const page = await pdfDocRef.current.getPage(pageNum);
        const viewport = page.getViewport({
          scale: (zoom / 100) * window.devicePixelRatio,
          rotation,
        });
 
        canvas.width = viewport.width;
        canvas.height = viewport.height;
 
        const context = canvas.getContext('2d');
        if (!context) return;
 
        await page.render({
          canvasContext: context,
          viewport,
        }).promise;
 
        // Apply dark mode
        if (darkMode) {
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            data[i] = 255 - data[i];
            data[i + 1] = 255 - data[i + 1];
            data[i + 2] = 255 - data[i + 2];
          }
          context.putImageData(imageData, 0, 0);
        }
 
        renderedPagesRef.current.add(pageNum);
        redrawAnnotations(pageNum);
      } catch (err) {
        console.error(`Error rendering page ${pageNum}:`, err);
      }
    },
    [zoom, rotation, darkMode]
  );
 
  // Render visible pages
  const renderVisiblePages = useCallback(() => {
    if (!containerRef.current) return;
 
    const { scrollTop, clientHeight } = containerRef.current;
    const pageElements = containerRef.current.querySelectorAll('[data-page]');
 
    pageElements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      const pageNum = parseInt(element.getAttribute('data-page') || '0');
      const canvas = canvasRefs.current.get(pageNum);
 
      // Render if visible or near visible
      if (rect.top < clientHeight + 500 && rect.bottom > -500 && canvas) {
        renderPage(pageNum, canvas);
      }
    });
  }, [renderPage]);
 
  // Scroll handler
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
 
    const currentScrollY = containerRef.current.scrollTop;
    const delta = currentScrollY - lastScrollY;
 
    // Hide/show top bar based on scroll direction
    if (delta > 10) {
      setShowTopBar(false);
    } else if (delta < -10) {
      setShowTopBar(true);
    }
 
    setLastScrollY(currentScrollY);
    renderVisiblePages();
  }, [lastScrollY, renderVisiblePages]);
 
  // Drag to pan
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (annotationMode !== 'none') return;
    if (zoom <= 100) return; // Only allow panning when zoomed in
 
    dragStateRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: containerRef.current?.scrollLeft || 0,
      scrollTop: containerRef.current?.scrollTop || 0,
    };
 
    e.preventDefault();
  };
 
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragStateRef.current.isDragging || !containerRef.current) return;
 
    const dx = e.clientX - dragStateRef.current.startX;
    const dy = e.clientY - dragStateRef.current.startY;
 
    containerRef.current.scrollLeft = dragStateRef.current.scrollLeft - dx;
    containerRef.current.scrollTop = dragStateRef.current.scrollTop - dy;
  };
 
  const handleMouseUp = () => {
    dragStateRef.current.isDragging = false;
  };
 
  // Text selection
  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      // Text is selected, allow copy
      return;
    }
 
    handleMouseUp();
  };
 
  // Annotation drawing
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (annotationMode === 'draw') {
      e.preventDefault();
      setIsDrawing(true);
      const rect = e.currentTarget.getBoundingClientRect();
      setCurrentDrawPoints([{ x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    } else if (annotationMode === 'highlight') {
      handleMouseDown(e);
    } else {
      handleMouseDown(e);
    }
  };
 
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (annotationMode === 'draw' && isDrawing) {
      const rect = e.currentTarget.getBoundingClientRect();
      setCurrentDrawPoints((prev) => [
        ...prev,
        { x: e.clientX - rect.left, y: e.clientY - rect.top },
      ]);
    } else {
      handleMouseMove(e);
    }
  };
 
  const handleCanvasMouseUp_Draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (annotationMode === 'draw' && isDrawing) {
      setIsDrawing(false);
      const pageNum = parseInt(e.currentTarget.getAttribute('data-page') || '0');
      const annotation: Annotation = {
        id: Math.random().toString(),
        type: 'draw',
        pageNum,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        color: highlightColor,
        points: currentDrawPoints,
      };
      setAnnotations((prev) => [...prev, annotation]);
      setCurrentDrawPoints([]);
      redrawAnnotations(pageNum);
    } else {
      handleCanvasMouseUp();
    }
  };
 
  // Redraw annotations
  const redrawAnnotations = (pageNum: number) => {
    const canvas = annotationCanvasRefs.current.get(pageNum);
    if (!canvas) return;
 
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
 
    ctx.clearRect(0, 0, canvas.width, canvas.height);
 
    const pageAnnotations = annotations.filter((a) => a.pageNum === pageNum);
 
    pageAnnotations.forEach((annotation) => {
      ctx.globalAlpha = 0.4;
 
      if (annotation.type === 'highlight') {
        ctx.fillStyle = annotation.color;
        ctx.fillRect(annotation.x, annotation.y, annotation.width, annotation.height);
      } else if (annotation.type === 'draw' && annotation.points) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = annotation.color;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        annotation.points.forEach((point, index) => {
          if (index === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
      }
    });
 
    ctx.globalAlpha = 1;
  };
 
  // Search
  const handleSearch = useCallback(async (query: string) => {
    if (!pdfDocRef.current || !query.trim()) {
      setSearchResults([]);
      return;
    }
 
    const pdf = pdfDocRef.current;
    const results = [];
 
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const text = textContent.items
          .filter((item) => 'str' in item)
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ');
 
        if (text.toLowerCase().includes(query.toLowerCase())) {
          results.push({ pageNum, text });
        }
      } catch (err) {
        console.error(`Error searching page ${pageNum}:`, err);
      }
    }
 
    setSearchResults(results);
  }, []);
 
  // Download
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = title || 'document.pdf';
    link.click();
  };
 
  // Scroll to page
  const scrollToPage = (pageNum: number) => {
    const element = containerRef.current?.querySelector(`[data-page="${pageNum}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setSidebarOpen(false);
    }
  };
 
  // Scroll to top
  const scrollToTop = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
 
  if (isLoading) {
    return (
      <div
        className={`flex items-center justify-center h-screen ${
          darkMode ? 'bg-gray-900' : 'bg-white'
        }`}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Loading PDF...
          </p>
        </div>
      </div>
    );
  }
 
  if (error) {
    return (
      <div
        className={`flex items-center justify-center h-screen ${
          darkMode ? 'bg-gray-900' : 'bg-white'
        }`}
      >
        <div
          className={`p-6 rounded-lg max-w-md ${
            darkMode ? 'bg-gray-800' : 'bg-gray-50'
          }`}
        >
          <p className="text-red-500 font-semibold mb-2">Error</p>
          <p className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{error}</p>
        </div>
      </div>
    );
  }
 
  return (
    <div
      ref={containerRef}
      className={`relative w-full h-screen overflow-y-auto overflow-x-hidden scroll-smooth transition-colors ${
        darkMode ? 'bg-gray-900' : 'bg-white'
      }`}
      onScroll={handleScroll}
      onMouseLeave={handleMouseUp}
      style={{ scrollBehavior: 'smooth' }}
    >
      {/* Top Bar */}
      <div
        className={`fixed top-0 left-0 right-0 z-40 transition-transform duration-300 ${
          showTopBar ? 'translate-y-0' : '-translate-y-full'
        } ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b shadow-sm`}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`p-2 rounded-lg transition ${
              darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
 
          <h1 className={`flex-1 text-center text-sm font-semibold truncate mx-4 ${
            darkMode ? 'text-gray-200' : 'text-gray-900'
          }`}>
            {title}
          </h1>
 
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2 rounded-lg transition ${
              darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </div>
 
      {/* Sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40"
          onClick={() => setSidebarOpen(false)}
        />
      )}
 
      <div
        className={`fixed left-0 top-0 bottom-0 z-40 w-72 transition-transform duration-300 overflow-y-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${darkMode ? 'bg-gray-800' : 'bg-white'}`}
      >
        <div className="p-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleSearch(e.target.value);
              }}
              className={`w-full px-4 py-2 pl-10 rounded-lg border transition ${
                darkMode
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-gray-50 border-gray-300 text-gray-900'
              }`}
            />
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          </div>
 
          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <p className={`text-xs font-semibold ${
                darkMode ? 'text-gray-400' : 'text-gray-500'
              } uppercase`}>
                Results ({searchResults.length})
              </p>
              {searchResults.map((result) => (
                <button
                  key={result.pageNum}
                  onClick={() => scrollToPage(result.pageNum)}
                  className={`w-full text-left p-2 rounded-lg transition ${
                    darkMode
                      ? 'hover:bg-gray-700 text-gray-300'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <p className="text-sm font-medium">Page {result.pageNum}</p>
                  <p className="text-xs truncate opacity-75">{result.text.substring(0, 50)}...</p>
                </button>
              ))}
            </div>
          )}
 
          {/* Pages */}
          <div className="space-y-2">
            <p className={`text-xs font-semibold ${
              darkMode ? 'text-gray-400' : 'text-gray-500'
            } uppercase`}>
              Pages ({totalPages})
            </p>
            <div className="grid grid-cols-4 gap-2 max-h-96 overflow-y-auto">
              {Array.from({ length: totalPages }).map((_, idx) => (
                <button
                  key={idx + 1}
                  onClick={() => scrollToPage(idx + 1)}
                  className={`aspect-square rounded-lg font-medium text-xs transition ${
                    darkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>
 
          {/* Tools */}
          <div className="space-y-3 pt-4 border-t border-gray-300 dark:border-gray-700">
            {/* Zoom */}
            <div className="space-y-2">
              <p className={`text-xs font-semibold ${
                darkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Zoom: {zoom}%
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setZoom(Math.max(50, zoom - 10))}
                  className={`flex-1 p-2 rounded-lg transition flex items-center justify-center ${
                    darkMode
                      ? 'bg-gray-700 hover:bg-gray-600'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <ZoomOut size={18} />
                </button>
                <button
                  onClick={() => setZoom(100)}
                  className={`flex-1 p-2 rounded-lg transition text-xs font-medium ${
                    darkMode
                      ? 'bg-gray-700 hover:bg-gray-600'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  Reset
                </button>
                <button
                  onClick={() => setZoom(Math.min(200, zoom + 10))}
                  className={`flex-1 p-2 rounded-lg transition flex items-center justify-center ${
                    darkMode
                      ? 'bg-gray-700 hover:bg-gray-600'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <ZoomIn size={18} />
                </button>
              </div>
            </div>
 
            {/* Rotation */}
            <button
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className={`w-full p-3 rounded-lg transition font-medium flex items-center justify-center gap-2 ${
                darkMode
                  ? 'bg-gray-700 hover:bg-gray-600'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <RotateCw size={18} />
              Rotate {rotation}°
            </button>
 
            {/* Download */}
            <button
              onClick={handleDownload}
              className={`w-full p-3 rounded-lg transition font-medium flex items-center justify-center gap-2 ${
                darkMode
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-blue-500 hover:bg-blue-600'
              } text-white`}
            >
              <Download size={18} />
              Download
            </button>
          </div>
 
          {/* Annotations */}
          {annotations.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-gray-300 dark:border-gray-700">
              <p className={`text-xs font-semibold ${
                darkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Annotations ({annotations.length})
              </p>
              <button
                onClick={() => setAnnotations([])}
                className={`w-full p-2 rounded-lg text-red-500 font-medium flex items-center justify-center gap-2 transition ${
                  darkMode
                    ? 'hover:bg-gray-700'
                    : 'hover:bg-gray-100'
                }`}
              >
                <Trash2 size={16} />
                Clear All
              </button>
            </div>
          )}
        </div>
      </div>
 
      {/* PDF Content */}
      <div className="pt-16 pb-24">
        {Array.from({ length: totalPages }).map((_, idx) => {
          const pageNum = idx + 1;
          return (
            <div
              key={pageNum}
              data-page={pageNum}
              className="flex justify-center py-4 px-2"
            >
              <div className="relative">
                <canvas
                  ref={(el) => {
                    if (el) canvasRefs.current.set(pageNum, el);
                  }}
                  style={{
                    transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                    transformOrigin: 'top center',
                    cursor: annotationMode === 'draw' ? 'crosshair' : zoom > 100 ? 'grab' : 'default',
                  }}
                  className={`block rounded-lg shadow-lg mx-auto max-w-full ${
                    darkMode ? 'bg-gray-800' : 'bg-white'
                  }`}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp_Draw}
                  data-page={pageNum}
                />
                <canvas
                  ref={(el) => {
                    if (el) annotationCanvasRefs.current.set(pageNum, el);
                  }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                    transformOrigin: 'top center',
                    cursor: annotationMode === 'draw' ? 'crosshair' : 'default',
                  }}
                  className="rounded-lg"
                />
              </div>
            </div>
          );
        })}
      </div>
 
      {/* Floating Annotation Toolbar */}
      {totalPages > 0 && (
        <div
          className={`fixed bottom-0 left-0 right-0 z-20 transition-transform duration-300 ${
            showTopBar ? 'translate-y-0' : 'translate-y-full'
          } ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-t shadow-lg`}
        >
          <div className="flex items-center justify-between px-4 py-3 gap-2 overflow-x-auto">
            {/* Annotation Tools */}
            <div className="flex items-center gap-2">
              {/* Highlight */}
              <button
                onClick={() => setAnnotationMode(annotationMode === 'highlight' ? 'none' : 'highlight')}
                className={`p-3 rounded-lg transition ${
                  annotationMode === 'highlight'
                    ? 'bg-yellow-500 text-white'
                    : darkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
                title="Highlight"
              >
                <Highlighter size={20} />
              </button>
 
              {/* Color Picker */}
              <input
                type="color"
                value={highlightColor}
                onChange={(e) => setHighlightColor(e.target.value)}
                className="w-12 h-12 rounded-lg cursor-pointer border-0"
                title="Annotation color"
              />
 
              {/* Draw */}
              <button
                onClick={() => setAnnotationMode(annotationMode === 'draw' ? 'none' : 'draw')}
                className={`p-3 rounded-lg transition ${
                  annotationMode === 'draw'
                    ? 'bg-blue-500 text-white'
                    : darkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
                title="Draw"
              >
                <Pen size={20} />
              </button>
 
              {/* Note */}
              <button
                onClick={() => setAnnotationMode(annotationMode === 'note' ? 'none' : 'note')}
                className={`p-3 rounded-lg transition ${
                  annotationMode === 'note'
                    ? 'bg-green-500 text-white'
                    : darkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
                title="Add note"
              >
                <MessageSquare size={20} />
              </button>
            </div>
 
            {/* Spacer */}
            <div className="flex-1" />
 
            {/* Scroll to Top */}
            <button
              onClick={scrollToTop}
              className={`p-3 rounded-lg transition ${
                darkMode
                  ? 'bg-gray-700 hover:bg-gray-600'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
              title="Scroll to top"
            >
              <ChevronUp size={20} />
            </button>
 
            {/* Home */}
            <button
              onClick={() => window.location.reload()}
              className={`p-3 rounded-lg transition ${
                darkMode
                  ? 'bg-gray-700 hover:bg-gray-600'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
              title="Reload"
            >
              <Home size={20} />
            </button>
          </div>
 
          {/* Mode Indicator */}
          {annotationMode !== 'none' && (
            <div className={`px-4 py-2 text-center text-xs font-medium ${
              darkMode
                ? 'bg-gray-700 text-gray-300'
                : 'bg-gray-100 text-gray-700'
            }`}>
              {annotationMode === 'highlight' && `Highlight Mode - Color: ${highlightColor}`}
              {annotationMode === 'draw' && `Draw Mode - Color: ${highlightColor}`}
              {annotationMode === 'note' && 'Note Mode'}
            </div>
          )}
        </div>
      )}
 
      {/* Selection friendly overlay for text selection */}
      <style>{`
        canvas {
          user-select: text;
          -webkit-user-select: text;
          -moz-user-select: text;
          -ms-user-select: text;
        }
      `}</style>
    </div>
  );
};
 
export function ViewerTool() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('');
 
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setTitle(file.name);
      setPdfUrl(URL.createObjectURL(file));
    }
  };
 
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') {
      setTitle(file.name);
      setPdfUrl(URL.createObjectURL(file));
    }
  };
 
  if (pdfUrl) {
    return <MobileWebtoonPDFViewer pdfUrl={pdfUrl} title={title} />;
  }
 
  return (
    <div
      className="flex flex-col items-center justify-center p-10 h-full border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl m-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onClick={() => document.getElementById('pdf-upload')?.click()}
    >
      <input
        id="pdf-upload"
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />
      <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-full mb-4">
        <svg
          className="w-10 h-10 text-indigo-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
      </div>
      <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-2">Upload PDF</h3>
      <p className="text-gray-500 dark:text-gray-400">Click or drag and drop a PDF file here</p>
    </div>
  );
}
 
export default ViewerTool;