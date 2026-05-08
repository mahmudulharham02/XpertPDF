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

// Configuration for large PDFs
const CONFIG = {
  MAX_CACHED_PAGES: 8,
  RENDER_BUFFER: 3,
  MIN_RENDER_INTERVAL: 100,
};

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

interface PageCache {
  canvas: HTMLCanvasElement;
  rendered: boolean;
  timestamp: number;
}

interface TouchState {
  initialDistance: number;
  initialZoom: number;
  isTouching: boolean;
}

const MobileWebtoonPDFViewer: React.FC<{ pdfUrl: string; title?: string; onHome?: () => void }> = ({
  pdfUrl,
  title = 'PDF Viewer',
  onHome,
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
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set());

  // Refs
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageCacheRef = useRef<Map<number, PageCache>>(new Map());
  const annotationCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderQueueRef = useRef<Set<number>>(new Set());
  const lastRenderTimeRef = useRef(0);
  const touchStateRef = useRef<TouchState>({
    initialDistance: 0,
    initialZoom: 100,
    isTouching: false,
  });

  // Load PDF
  useEffect(() => {
    const loadPDF = async () => {
      try {
        setIsLoading(true);
        const pdf = await pdfjsLib.getDocument({
          url: pdfUrl,
          cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
          cMapPacked: true,
        }).promise;
        pdfDocRef.current = pdf;
        setTotalPages(pdf.numPages);
        // Trigger initial render
        setTimeout(() => {
          calculateVisiblePages();
        }, 50);
      } catch (err) {
        setError(`Failed to load PDF: ${err instanceof Error ? err.message : 'Unknown error'}`);
        console.error('PDF Load Error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadPDF();
  }, [pdfUrl]);

  // Calculate visible pages
  const calculateVisiblePages = useCallback(() => {
    if (!containerRef.current || totalPages === 0) return;

    const { scrollTop, clientHeight, scrollHeight } = containerRef.current;
    const pageHeight = scrollHeight / totalPages;
    const buffer = CONFIG.RENDER_BUFFER;

    const firstVisible = Math.max(1, Math.floor(scrollTop / pageHeight) - buffer);
    const lastVisible = Math.min(
      totalPages,
      Math.ceil((scrollTop + clientHeight) / pageHeight) + buffer
    );

    const newVisible = new Set<number>();
    for (let i = firstVisible; i <= lastVisible; i++) {
      newVisible.add(i);
    }

    setVisiblePages(newVisible);
  }, [totalPages]);

  // Scroll handler
  const handleScroll = useCallback(() => {
    calculateVisiblePages();
  }, [calculateVisiblePages]);

  // Render page with optimizations
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDocRef.current) return;
      if (pageCacheRef.current.has(pageNum)) return;

      try {
        const page = await pdfDocRef.current.getPage(pageNum);
        
        // Get natural page dimensions
        const baseViewport = page.getViewport({ scale: 1 });
        const pageWidth = baseViewport.width;
        const pageHeight = baseViewport.height;
        
        // Calculate appropriate scale
        const maxWidth = Math.min(window.innerWidth - 16, 800);
        const baseScale = maxWidth / pageWidth;
        const scale = baseScale * (zoom / 100) * window.devicePixelRatio;

        const viewport = page.getViewport({
          scale,
          rotation,
        });

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) return;

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'medium';

        // Render
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

        // Store in cache
        pageCacheRef.current.set(pageNum, {
          canvas,
          rendered: true,
          timestamp: Date.now(),
        });

        // Cleanup old pages
        if (pageCacheRef.current.size > CONFIG.MAX_CACHED_PAGES) {
          let oldestPage = -1;
          let oldestTime = Date.now();

          pageCacheRef.current.forEach((cache, page) => {
            if (cache.timestamp < oldestTime && !visiblePages.has(page)) {
              oldestTime = cache.timestamp;
              oldestPage = page;
            }
          });

          if (oldestPage !== -1) {
            pageCacheRef.current.delete(oldestPage);
          }
        }

        // Insert into DOM
        const pageContainer = document.querySelector(`[data-page-container="${pageNum}"]`);
        if (pageContainer) {
          const existingCanvas = pageContainer.querySelector('canvas[data-type="page"]');
          canvas.setAttribute('data-type', 'page');
          
          if (existingCanvas) {
            existingCanvas.replaceWith(canvas);
          } else {
            pageContainer.appendChild(canvas);
          }

          // Update annotation canvas size
          const annotationCanvas = annotationCanvasRefs.current.get(pageNum);
          if (annotationCanvas) {
            annotationCanvas.width = canvas.width;
            annotationCanvas.height = canvas.height;
            redrawAnnotations(pageNum);
          }
        }
      } catch (err) {
        console.error(`Error rendering page ${pageNum}:`, err);
      }
    },
    [zoom, rotation, darkMode, visiblePages]
  );

  // Render visible pages
  useEffect(() => {
    if (totalPages === 0 || visiblePages.size === 0) return;

    const now = Date.now();
    if (now - lastRenderTimeRef.current < CONFIG.MIN_RENDER_INTERVAL) {
      return;
    }

    lastRenderTimeRef.current = now;

    // Sort pages by distance from viewport center
    const sortedPages = Array.from(visiblePages).sort(
      (a: number, b: number) => Math.abs(a - totalPages / 2) - Math.abs(b - totalPages / 2)
    );

    sortedPages.forEach((pageNum) => {
      if (!renderQueueRef.current.has(pageNum)) {
        renderQueueRef.current.add(pageNum);
        renderPage(pageNum).finally(() => {
          renderQueueRef.current.delete(pageNum);
        });
      }
    });
  }, [visiblePages, renderPage, totalPages]);

  // Redraw annotations
  const redrawAnnotations = (pageNum: number) => {
    const canvas = annotationCanvasRefs.current.get(pageNum);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const pageAnnotations = annotations.filter((a) => a.pageNum === pageNum);

    pageAnnotations.forEach((annotation) => {
      if (annotation.type === 'highlight') {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = annotation.color;
        ctx.fillRect(annotation.x, annotation.y, annotation.width, annotation.height);
      } else if (annotation.type === 'draw' && annotation.points) {
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = annotation.color;
        ctx.lineWidth = 2;
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

  // Touch pinch zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );

      touchStateRef.current = {
        initialDistance: distance,
        initialZoom: zoom,
        isTouching: true,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStateRef.current.isTouching) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );

      const newZoom =
        (touchStateRef.current.initialZoom * distance) / touchStateRef.current.initialDistance;
      setZoom(Math.max(50, Math.min(200, newZoom)));
    }
  };

  const handleTouchEnd = () => {
    touchStateRef.current.isTouching = false;
  };

  // Search
  const handleSearch = useCallback(async (query: string) => {
    if (!pdfDocRef.current || !query.trim()) {
      setSearchResults([]);
      return;
    }

    const pdf = pdfDocRef.current;
    const results = [];

    try {
      for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 300); pageNum++) {
        if (results.length >= 50) break;

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
        } catch {
          continue;
        }
      }
    } catch (err) {
      console.error('Search error:', err);
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
    if (!containerRef.current) return;
    const pageHeight = containerRef.current.scrollHeight / totalPages;
    const targetScroll = (pageNum - 1) * pageHeight;
    containerRef.current.scrollTo({ top: targetScroll, behavior: 'smooth' });
    setSidebarOpen(false);
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
          darkMode ? 'bg-gray-950' : 'bg-gray-50'
        }`}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4" />
          <p className={`font-medium text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
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
          darkMode ? 'bg-gray-950' : 'bg-gray-50'
        }`}
      >
        <div
          className={`p-6 rounded-lg max-w-md text-center ${
            darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-900'
          }`}
        >
          <p className="text-red-500 font-semibold mb-2">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-screen overflow-y-auto overflow-x-hidden scroll-smooth transition-colors ${
        darkMode ? 'bg-gray-950' : 'bg-gray-50'
      }`}
      onScroll={handleScroll}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Bar - Sticky */}
      <div
        className={`sticky top-0 z-40 ${
          darkMode
            ? 'bg-gray-800 border-gray-700'
            : 'bg-white border-gray-200'
        } border-b shadow-md transition-colors`}
      >
        <div className="flex items-center justify-between px-4 py-5 gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`p-2 rounded-lg transition flex-shrink-0 ${
              darkMode
                ? 'hover:bg-gray-700 text-gray-200'
                : 'hover:bg-gray-100 text-gray-800'
            }`}
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <h1
            className={`flex-1 text-center text-sm font-semibold truncate ${
              darkMode ? 'text-gray-100' : 'text-gray-900'
            }`}
          >
            {title}
          </h1>

          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2 rounded-lg transition flex-shrink-0 ${
              darkMode
                ? 'hover:bg-gray-700 text-gray-200'
                : 'hover:bg-gray-100 text-gray-800'
            }`}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </div>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 bottom-0 z-40 w-80 transition-transform duration-300 overflow-y-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${darkMode ? 'bg-gray-800' : 'bg-white'}`}
      >
        <div className="p-4 space-y-4 pt-28">
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
              className={`w-full px-4 py-2 pl-10 rounded-lg border text-sm transition ${
                darkMode
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'
              } focus:outline-none focus:border-blue-500`}
            />
            <Search size={16} className={`absolute left-3 top-3 ${
              darkMode ? 'text-gray-500' : 'text-gray-400'
            }`} />
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <p className={`text-xs font-bold uppercase tracking-wide ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                📄 {searchResults.length} Results
              </p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {searchResults.map((result) => (
                  <button
                    key={result.pageNum}
                    onClick={() => scrollToPage(result.pageNum)}
                    className={`w-full text-left p-3 rounded transition text-sm font-medium ${
                      darkMode
                        ? 'hover:bg-gray-700 text-gray-300'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    Page {result.pageNum}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pages */}
          <div className={`space-y-2 pt-2 border-t ${
            darkMode ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <p className={`text-xs font-bold uppercase tracking-wide ${
              darkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              📑 Pages ({totalPages})
            </p>
            <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto">
              {Array.from({ length: totalPages }).map((_, idx) => (
                <button
                  key={idx + 1}
                  onClick={() => scrollToPage(idx + 1)}
                  className={`aspect-square rounded font-bold text-xs transition ${
                    darkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Tools */}
          <div className={`space-y-3 pt-2 border-t ${
            darkMode ? 'border-gray-700' : 'border-gray-200'
          }`}>
            {/* Zoom */}
            <div className="space-y-2">
              <p className={`text-xs font-bold uppercase tracking-wide ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                🔍 Zoom: {Math.round(zoom)}%
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setZoom(Math.max(50, zoom - 10))}
                  className={`flex-1 p-2 rounded transition flex items-center justify-center ${
                    darkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  }`}
                >
                  <ZoomOut size={18} />
                </button>
                <button
                  onClick={() => setZoom(100)}
                  className={`flex-1 p-2 rounded transition text-xs font-bold ${
                    darkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  }`}
                >
                  100
                </button>
                <button
                  onClick={() => setZoom(Math.min(200, zoom + 10))}
                  className={`flex-1 p-2 rounded transition flex items-center justify-center ${
                    darkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  }`}
                >
                  <ZoomIn size={18} />
                </button>
              </div>
              <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                💡 Two fingers to pinch zoom
              </p>
            </div>

            {/* Rotation */}
            <button
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className={`w-full p-3 rounded transition font-medium flex items-center justify-center gap-2 text-sm ${
                darkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
              }`}
            >
              <RotateCw size={18} />
              Rotate {rotation}°
            </button>

            {/* Annotations */}
            <div className={`space-y-2 pt-2 border-t ${
              darkMode ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <p className={`text-xs font-bold uppercase tracking-wide ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                ✏️ Annotations
              </p>

              <button
                onClick={() => setAnnotationMode(annotationMode === 'highlight' ? 'none' : 'highlight')}
                className={`w-full p-2 rounded transition flex items-center justify-center gap-2 text-sm font-medium ${
                  annotationMode === 'highlight'
                    ? 'bg-yellow-500 text-white'
                    : darkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                }`}
              >
                <Highlighter size={16} />
                Highlight
              </button>

              <div className="flex gap-2">
                <input
                  type="color"
                  value={highlightColor}
                  onChange={(e) => setHighlightColor(e.target.value)}
                  className="w-12 h-10 rounded cursor-pointer border-0"
                />
                <button
                  onClick={() => setAnnotationMode(annotationMode === 'draw' ? 'none' : 'draw')}
                  className={`flex-1 p-2 rounded transition flex items-center justify-center gap-2 text-sm font-medium ${
                    annotationMode === 'draw'
                      ? 'bg-blue-500 text-white'
                      : darkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  }`}
                >
                  <Pen size={16} />
                  Draw
                </button>
              </div>

              <button
                onClick={() => setAnnotationMode(annotationMode === 'note' ? 'none' : 'note')}
                className={`w-full p-2 rounded transition flex items-center justify-center gap-2 text-sm font-medium ${
                  annotationMode === 'note'
                    ? 'bg-green-500 text-white'
                    : darkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                }`}
              >
                <MessageSquare size={16} />
                Note
              </button>

              {annotations.length > 0 && (
                <button
                  onClick={() => setAnnotations([])}
                  className={`w-full p-2 rounded transition flex items-center justify-center gap-2 text-sm font-medium ${
                    darkMode
                      ? 'text-red-400 hover:bg-gray-700'
                      : 'text-red-600 hover:bg-gray-100'
                  }`}
                >
                  <Trash2 size={16} />
                  Clear ({annotations.length})
                </button>
              )}
            </div>

            {/* Download */}
            <button
              onClick={handleDownload}
              className={`w-full p-3 rounded transition font-bold flex items-center justify-center gap-2 text-sm ${
                darkMode
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              <Download size={18} />
              Download
            </button>

            {/* Scroll */}
            <div className="flex gap-2">
              <button
                onClick={scrollToTop}
                className={`flex-1 p-2 rounded transition flex items-center justify-center gap-1 text-sm font-medium ${
                  darkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                }`}
              >
                <ChevronUp size={16} />
                Top
              </button>
              <button
                onClick={onHome}
                className={`flex-1 p-2 rounded transition flex items-center justify-center gap-1 text-sm font-medium ${
                  darkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                }`}
              >
                <Home size={16} />
                Home
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Pages */}
      <div className="pb-8">
        {Array.from({ length: totalPages }).map((_, idx) => {
          const pageNum = idx + 1;
          return (
            <div
              key={pageNum}
              data-page-container={pageNum}
              className="flex justify-center py-3 px-2"
              style={{
                minHeight: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {!visiblePages.has(pageNum) && (
                <div className={`text-xs py-24 ${
                  darkMode ? 'text-gray-600' : 'text-gray-300'
                }`}>
                  Page {pageNum}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mode Indicator */}
      {annotationMode !== 'none' && (
        <div
          className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg text-xs font-bold shadow-lg ${
            darkMode
              ? 'bg-gray-700 text-gray-200'
              : 'bg-gray-800 text-white'
          }`}
        >
          {annotationMode === 'highlight' && `✏️ Highlight - ${highlightColor}`}
          {annotationMode === 'draw' && `🖊️ Draw - ${highlightColor}`}
          {annotationMode === 'note' && '📝 Note Mode'}
        </div>
      )}
    </div>
  );
};

export function ViewerTool({ onPdfOpen }: { onPdfOpen?: (isOpen: boolean) => void }) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('');

  useEffect(() => {
    onPdfOpen?.(!!pdfUrl);
    return () => {
      onPdfOpen?.(false);
    };
  }, [pdfUrl, onPdfOpen]);

  // Handle Home button in MobileWebtoonPDFViewer
  const handleHome = useCallback(() => {
    setPdfUrl(null);
  }, []);

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
    return <MobileWebtoonPDFViewer pdfUrl={pdfUrl} title={title} onHome={handleHome} />;
  }

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 h-full border-2 border-dashed rounded-xl m-4 cursor-pointer transition ${
        false
          ? 'border-gray-700 hover:bg-gray-800'
          : 'border-gray-300 hover:bg-gray-50'
      }`}
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
      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Upload PDF</h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm text-center">
        Click or drag and drop a PDF file
      </p>
      <p className="text-gray-500 dark:text-gray-500 text-xs mt-3">
        ⚡ Optimized for 500+ pages
      </p>
    </div>
  );
}

export default ViewerTool;