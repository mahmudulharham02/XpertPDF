import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import Draggable from 'react-draggable';
import { UploadCloud, FileUp, Type, Image as ImageIcon, Settings2, Download, AlertCircle, Loader2 } from 'lucide-react';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// @ts-expect-error Vite handles this
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

class ToolErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    (this as any).state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if ((this as any).state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center text-rose-500">
           <AlertCircle className="w-12 h-12 mb-4" />
           <h2 className="text-xl font-bold mb-2">Something went wrong.</h2>
           <p className="text-sm font-medium mb-4">The tool encountered a critical rendering error.</p>
           <button onClick={() => (this as any).setState({hasError: false})} className="px-4 py-2 bg-rose-100 rounded-lg text-rose-700 font-bold">Retry</button>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

export function WatermarkTool() {
  return (
    <ToolErrorBoundary>
       <WatermarkToolInner />
    </ToolErrorBoundary>
  );
}

function WatermarkToolInner() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const [type, setType] = useState<'text' | 'image'>('text');
  const [text, setText] = useState('CONFIDENTIAL');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  
  const [opacity, setOpacity] = useState(25);
  const [scale, setScale] = useState(100);
  const [rotation, setRotation] = useState(45);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewError, setPreviewError] = useState('');
  
  const [watermarkPos, setWatermarkPos] = useState({ x: 0, y: 0 });
  const [pageRatio, setPageRatio] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggableRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);

  const renderPreview = async () => {
    if (!previewDoc || !canvasRef.current || !containerRef.current) return;
    try {
      if (renderTaskRef.current) {
         renderTaskRef.current.cancel();
      }

      const page = await previewDoc.getPage(1);
      const viewport = page.getViewport({ scale: 1.5 });
      setPageRatio(viewport.width / viewport.height);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const outputScale = window.devicePixelRatio || 1;
      canvas.width = viewport.width * outputScale;
      canvas.height = viewport.height * outputScale;
      canvas.style.width = `100%`;
      canvas.style.height = `100%`;
      ctx.setTransform(outputScale, 0, 0, outputScale, 0, 0);
      
      const renderContext = { canvasContext: ctx, viewport, transform: [outputScale, 0, 0, outputScale, 0, 0] };
      const renderTask = page.render(renderContext as any);
      renderTaskRef.current = renderTask;
      await renderTask.promise;
      
    } catch (e: any) {
      if (e.name !== 'RenderingCancelledException') {
         console.error('Preview render error:', e);
         setPreviewError('Could not process preview.');
      }
    }
  };

  useEffect(() => {
     renderPreview();
     return () => {
        if (renderTaskRef.current) renderTaskRef.current.cancel();
     };
  }, [previewDoc]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const f = acceptedFiles[0];
      
      if (f.size > 50 * 1024 * 1024) {
         setPreviewError("Warning: File is over 50MB and may be slow to process.");
      } else {
         setPreviewError("");
      }

      setFile(f);
      setFileName(f.name);
      
      try {
        console.log(`Loading PDF: ${f.name} (${f.size} bytes)`);
        
        const arrayBuffer = await f.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        const headerBytes = uint8Array.slice(0, 4);
        const headerString = new TextDecoder().decode(headerBytes);
        console.log(`PDF Header: "${headerString}"`);
        
        if (!headerString.startsWith('%PDF')) {
          setPreviewError('Invalid PDF file. Not a valid PDF document.');
          setFile(null);
          return;
        }

        setPdfBytes(uint8Array);
        console.log('PDF bytes stored successfully');
        
        try {
          console.log('Loading with pdfjs...');
          const pdfDoc = await pdfjsLib.getDocument({ 
            data: uint8Array,
            disableAutoFetch: false,
            disableStream: false
          }).promise;
          console.log(`PDF loaded: ${pdfDoc.numPages} pages`);
          setPreviewDoc(pdfDoc);
        } catch (pdfError: any) {
          console.error('pdfjs error:', pdfError);
          setPreviewError(`Could not load PDF: ${pdfError.message}`);
          setFile(null);
        }
        
      } catch (e: any) {
        console.error('File reading error:', e);
        setPreviewError(`Error: ${e.message}`);
        setFile(null);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDrop as any,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false
  } as any);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const imgFile = e.target.files[0];
      setImageFile(imgFile);
      setImagePreviewUrl(URL.createObjectURL(imgFile));
    }
  };

  const downloadFile = (blob: Blob, filename: string) => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleApplyWatermark = async () => {
    if (!pdfBytes || !previewDoc) {
      setPreviewError('No PDF loaded');
      return;
    }
    
    setLoading(true);
    setPreviewError('');

    try {
      const numPages = previewDoc.numPages;
      console.log(`Processing ${numPages} pages...`);

      // Try pdf-lib approach first
      let success = false;
      let watermarkedPdfBytes: Uint8Array | null = null;

      try {
        console.log('Attempting pdf-lib modification...');
        
        // Create a copy of the bytes
        const pdfBytesCopy = new Uint8Array(pdfBytes);
        
        const pdfDoc = await PDFDocument.load(pdfBytesCopy, { 
          ignoreEncryption: true,
          updateMetadata: false
        });
        
        const pages = pdfDoc.getPages();
        console.log(`pdf-lib loaded: ${pages.length} pages`);

        let imageToEmbed: any = null;
        let dims: { width: number, height: number } | null = null;

        if (type === 'image' && imageFile) {
          const imgBytes = await imageFile.arrayBuffer();
          if (imageFile.type === 'image/png') {
            imageToEmbed = await pdfDoc.embedPng(imgBytes);
          } else if (imageFile.type === 'image/jpeg' || imageFile.type === 'image/jpg') {
            imageToEmbed = await pdfDoc.embedJpg(imgBytes);
          }
          if (imageToEmbed) {
            dims = imageToEmbed.scale((scale / 100) * 0.5);
          }
        }

        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fontSize = (120 * scale) / 100;

        for (const page of pages) {
          const { width, height } = page.getSize();
          
          let px = width / 2;
          let py = height / 2;

          if (containerRef.current) {
             const rect = containerRef.current.getBoundingClientRect();
             const normalizedX = (watermarkPos.x + rect.width / 2) / rect.width;
             const normalizedY = (watermarkPos.y + rect.height / 2) / rect.height;
             px = width * normalizedX;
             py = height * (1 - normalizedY);
          }

          if (type === 'text' && text) {
             const textWidth = font.widthOfTextAtSize(text, fontSize);
             const textHeight = font.heightAtSize(fontSize);
             
             page.drawText(text, {
               x: px - textWidth / 2,
               y: py - textHeight / 2,
               size: fontSize,
               font: font,
               color: rgb(0, 0, 0),
               opacity: opacity / 100,
               rotate: degrees(-rotation) 
             });
          } else if (type === 'image' && imageToEmbed && dims) {
             page.drawImage(imageToEmbed, {
               x: px - dims.width / 2,
               y: py - dims.height / 2,
               width: dims.width,
               height: dims.height,
               opacity: opacity / 100,
               rotate: degrees(-rotation)
             });
          }
        }

        watermarkedPdfBytes = await pdfDoc.save();
        success = true;
        console.log('pdf-lib method succeeded');

      } catch (pdfLibErr: any) {
        console.error('pdf-lib failed:', pdfLibErr.message);
        console.log('Trying canvas method as fallback...');

        // Fallback: Use canvas to watermark
        try {
          const canvases: HTMLCanvasElement[] = [];

          for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await previewDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2 });
            
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) continue;

            const renderContext = { canvasContext: ctx, viewport };
            await page.render(renderContext as any).promise;

            // Draw watermark on canvas
            ctx.save();
            ctx.globalAlpha = opacity / 100;
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((rotation * Math.PI) / 180);

            if (type === 'text' && text) {
              const fontSize = Math.round((120 * scale) / 100);
              ctx.font = `bold ${fontSize}px Arial`;
              ctx.fillStyle = 'black';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(text, 0, 0);
            } else if (type === 'image' && imagePreviewUrl) {
              const img = new Image();
              img.src = imagePreviewUrl;
              await new Promise((resolve) => {
                img.onload = () => {
                  const scaledWidth = img.width * (scale / 100);
                  const scaledHeight = img.height * (scale / 100);
                  ctx.drawImage(img, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
                  resolve(null);
                };
              });
            }

            ctx.restore();
            canvases.push(canvas);
          }

          // Convert canvases to PDF
          console.log('Converting canvas images to PDF...');
          const pdfDoc = await PDFDocument.create();

          for (const canvas of canvases) {
            const imgData = canvas.toDataURL('image/png');
            const imgBytes = await fetch(imgData).then(res => res.arrayBuffer());
            const embeddedImg = await pdfDoc.embedPng(imgBytes);
            
            const page = pdfDoc.addPage([canvas.width / 2, canvas.height / 2]);
            page.drawImage(embeddedImg, {
              x: 0,
              y: 0,
              width: canvas.width / 2,
              height: canvas.height / 2
            });
          }

          watermarkedPdfBytes = await pdfDoc.save();
          success = true;
          console.log('Canvas fallback method succeeded');

        } catch (canvasErr: any) {
          console.error('Canvas method also failed:', canvasErr);
          throw new Error(`Cannot process PDF: ${pdfLibErr.message}`);
        }
      }

      if (success && watermarkedPdfBytes) {
        const blob = new Blob([watermarkedPdfBytes], { type: 'application/pdf' });
        const outputFilename = fileName.replace('.pdf', '_watermarked.pdf');
        downloadFile(blob, outputFilename);
        setPreviewError('');
      }
      
    } catch (e: any) {
      console.error('Error:', e);
      setPreviewError(`Error: ${e.message || 'Failed to process PDF'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col pt-4 animate-in fade-in slide-in-from-bottom-4 duration-300 h-full w-full max-w-full">
      <div className="liquid-panel rounded-[24px] overflow-y-auto overflow-x-hidden flex flex-col flex-1 shadow-lg shadow-black/5 w-full">
        
        {previewError && (
              <div className="mx-6 mt-6 bg-rose-50 text-rose-600 p-4 rounded-xl text-sm font-bold border border-rose-100 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {previewError}
              </div>
        )}
        <div className="p-6 sm:p-10 border-b border-black/5 dark:border-white/10 bg-white/20 dark:bg-black/20 shrink-0">
          {!file ? (
            <div 
              {...getRootProps()} 
              className={`max-w-2xl w-full mx-auto liquid-panel rounded-[24px] p-6 sm:p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 pointer-events-auto ${
                isDragActive ? 'scale-[1.02] bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-400' : 'hover:bg-white/40 border-dashed border-2 border-indigo-200'
              }`}
            >
              <input {...getInputProps()} />
              <UploadCloud className={`w-12 h-12 mb-4 ${isDragActive ? 'text-indigo-500' : 'text-slate-400'}`} />
              <p className="text-lg font-bold text-slate-700">Drag & drop a PDF here</p>
              <p className="text-sm font-medium text-slate-500 mt-2">to add a watermark</p>
            </div>
          ) : (
            <div className="w-full max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between liquid-panel p-4 rounded-xl px-6 gap-4">
               <div className="flex items-center gap-3 w-full sm:w-auto overflow-hidden">
                  <div className="w-10 h-10 shrink-0 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                     <FileUp className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm border-none font-bold text-slate-700 truncate">{fileName}</h3>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">
                       {(file.size / 1024 / 1024).toFixed(2)} MB 
                    </p>
                  </div>
               </div>
               <button 
                  onClick={() => { setFile(null); setPdfBytes(null); setPreviewDoc(null); }}
                  className="px-4 flex items-center justify-center min-h-[44px] text-sm font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition-colors w-full sm:w-auto shrink-0"
               >
                  Change File
               </button>
            </div>
          )}
        </div>

        {file && (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
            
            <div className="w-full lg:w-80 border-r border-black/5 dark:border-white/10 p-4 sm:p-6 flex flex-col gap-6 overflow-y-auto shrink-0">
               <h3 className="font-bold text-slate-800 flex items-center gap-2">
                 <Settings2 className="w-5 h-5 text-indigo-500" /> Options
               </h3>
               
               <div className="flex bg-slate-100 p-1 rounded-lg">
                 <button onClick={() => setType('text')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-md transition-all ${type === 'text' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:bg-slate-200'}`}>
                   <Type className="w-4 h-4 cursor-pointer" /> Text
                 </button>
                 <button onClick={() => setType('image')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-md transition-all ${type === 'image' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:bg-slate-200'}`}>
                   <ImageIcon className="w-4 h-4 cursor-pointer" /> Image
                 </button>
               </div>

               {type === 'text' ? (
                 <div className="flex flex-col gap-2">
                   <label className="text-sm font-bold text-slate-700">Watermark Text</label>
                   <input type="text" value={text} onChange={(e) => setText(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold" />
                 </div>
               ) : (
                 <div className="flex flex-col gap-2">
                   <label className="text-sm font-bold text-slate-700">Watermark Image</label>
                   <input type="file" accept="image/png, image/jpeg" onChange={handleImageUpload} className="w-full bg-white border border-slate-200 rounded-lg p-2 min-h-[44px] text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                 </div>
               )}

               <div className="flex flex-col gap-2">
                 <label className="text-sm font-bold text-slate-700 flex justify-between">
                   <span>Opacity</span>
                   <span className="text-indigo-600">{opacity}%</span>
                 </label>
                 <input type="range" min="5" max="100" value={opacity} onChange={(e) => setOpacity(parseInt(e.target.value))} className="w-full cursor-pointer" />
               </div>

               <div className="flex flex-col gap-2">
                 <label className="text-sm font-bold text-slate-700 flex justify-between">
                   <span>Scale</span>
                   <span className="text-indigo-600">{scale}%</span>
                 </label>
                 <input type="range" min="10" max="300" value={scale} onChange={(e) => setScale(parseInt(e.target.value))} className="w-full cursor-pointer" />
               </div>

               <div className="flex flex-col gap-2">
                 <label className="text-sm font-bold text-slate-700 flex justify-between">
                   <span>Rotation</span>
                   <span className="text-indigo-600">{rotation}°</span>
                 </label>
                 <input type="range" min="-180" max="180" value={rotation} onChange={(e) => setRotation(parseInt(e.target.value))} className="w-full cursor-pointer" />
               </div>
               
               <div className="mt-auto pt-4 border-t border-black/5">
                 <button 
                  onClick={handleApplyWatermark}
                  disabled={loading || (type === 'image' && !imagePreviewUrl) || (type === 'text' && !text)}
                  className="flex justify-center items-center gap-2 px-6 py-3 min-h-[44px] w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
                 >
                   {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                   Export PDF
                 </button>
               </div>
            </div>

            <div className="flex-1 bg-slate-100 overflow-y-auto p-4 flex flex-col items-center justify-center relative min-h-[300px]">
               <div 
                 ref={containerRef}
                 className="bg-white shadow-lg overflow-hidden border border-slate-200 rounded relative" 
                 style={{ width: '100%', maxWidth: '400px', aspectRatio: `${pageRatio}`, objectFit: 'contain' }}
               >
                 <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
                 
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                   <Draggable
                     nodeRef={draggableRef}
                     bounds="parent"
                     defaultPosition={{x: 0, y: 0}}
                     onStop={(e, data) => setWatermarkPos({ x: data.x, y: data.y })}
                   >
                     <div 
                       ref={draggableRef}
                       className="cursor-move select-none pointer-events-auto flex items-center justify-center absolute" 
                       style={{ opacity: opacity / 100 }}
                     >
                         <div style={{ transform: `scale(${scale / 100}) rotate(${rotation}deg)` }}>
                           {type === 'text' ? (
                             <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'black', whiteSpace: 'nowrap' }}>{text}</span>
                           ) : (
                             imagePreviewUrl ? <img src={imagePreviewUrl} alt="watermark" draggable={false} style={{ pointerEvents: 'none' }} /> : null
                           )}
                         </div>
                     </div>
                   </Draggable>
                 </div>
               </div>
               <p className="absolute bottom-4 left-0 w-full text-center text-xs text-slate-500 font-bold px-4">
                 Previewing page 1 only. Watermark applies to all pages.
               </p>
            </div>
            
          </div>
        )}
        
      </div>
    </div>
  );
}