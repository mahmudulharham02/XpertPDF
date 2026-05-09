import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, PenTool, Eraser, Download, Loader2, ArrowLeft } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { downloadBlob, sanitizePdfBytes } from '../../lib/utils';
import * as pdfjsLib from 'pdfjs-dist';

// @ts-expect-error Vite handles this
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

type Stage = 'UPLOAD' | 'DRAW' | 'POSITION';

export function SignTool() {
  const [stage, setStage] = useState<Stage>('UPLOAD');
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'pdf' | 'image' | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>('');

  // Transform states
  const [sigPos, setSigPos] = useState({ x: 50, y: 50 });
  const [sigScale, setSigScale] = useState(0.5);
  const [sigRotation, setSigRotation] = useState(0);

  const previewFrameRef = useRef<HTMLDivElement>(null);
  const previewImgRef = useRef<HTMLImageElement>(null);

  // Dragging states
  const [isDraggingSig, setIsDraggingSig] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const f = acceptedFiles[0];
      setFile(f);
      setIsProcessing(true);

      try {
        if (f.type.includes('pdf')) {
          setFileType('pdf');
          const arrayBuffer = await f.arrayBuffer();
          const pdf = await pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: ctx, viewport } as any).promise;
            setPreviewUrl(canvas.toDataURL('image/jpeg', 0.8));
          }
        } else {
          setFileType('image');
          setPreviewUrl(URL.createObjectURL(f));
        }
        setStage('DRAW');
      } catch (err) {
        console.error(err);
        alert('Failed to load file preview.');
        setFile(null);
      } finally {
        setIsProcessing(false);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.png', '.jpeg', '.jpg', '.webp'] },
    maxFiles: 1
  } as any);

  // Drawing Canvas setup
  useEffect(() => {
    if (stage === 'DRAW' && drawCanvasRef.current) {
      const canvas = drawCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#0f172a'; // slate-900
      }
    }
  }, [stage]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (!drawCanvasRef.current) return;
    const ctx = drawCanvasRef.current.getContext('2d');
    if (ctx) ctx.beginPath(); // Reset path
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawCanvasRef.current) return;
    const canvas = drawCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearCanvas = () => {
    if (!drawCanvasRef.current) return;
    const canvas = drawCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const finishDrawing = () => {
    if (!drawCanvasRef.current) return;
    setSignatureDataUrl(drawCanvasRef.current.toDataURL('image/png'));
    setSigPos({ x: 50, y: 50 });
    setSigScale(0.5);
    setSigRotation(0);
    setStage('POSITION');
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDraggingSig(true);
    setDragStart({ x: e.clientX - sigPos.x, y: e.clientY - sigPos.y });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDraggingSig) {
      setSigPos({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDraggingSig(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const renderRotatedSignature = async (sigImg: HTMLImageElement, width: number, height: number): Promise<string> => {
    const tmpCanvas = document.createElement('canvas');
    const diag = Math.sqrt(width * width + height * height);
    tmpCanvas.width = diag;
    tmpCanvas.height = diag;
    const ctx = tmpCanvas.getContext('2d');
    if (!ctx) return '';
    
    ctx.translate(diag / 2, diag / 2);
    ctx.rotate((sigRotation * Math.PI) / 180);
    ctx.drawImage(sigImg, -width / 2, -height / 2, width, height);
    return tmpCanvas.toDataURL('image/png');
  };

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  const saveFile = async () => {
    if (!file || !previewImgRef.current) return;
    setIsProcessing(true);

    try {
      const sigImg = await loadImage(signatureDataUrl);
      const bgImg = await loadImage(previewUrl); // used to get nat dimensions

      const ratioX = bgImg.naturalWidth / previewImgRef.current.clientWidth;
      
      const sigNatWidth = sigImg.width;
      const sigNatHeight = sigImg.height;

      // Center of unscaled signature block in CSS pixels
      const Cx = sigPos.x + (sigNatWidth / 2);
      const Cy = sigPos.y + (sigNatHeight / 2);

      // Math for scaled signature
      const sigScaledWidth = sigNatWidth * sigScale * ratioX;
      const sigScaledHeight = sigNatHeight * sigScale * ratioX;
      const diagScaled = Math.sqrt(sigScaledWidth * sigScaledWidth + sigScaledHeight * sigScaledHeight);

      const rotatedDataUrl = await renderRotatedSignature(sigImg, sigScaledWidth, sigScaledHeight);
      const rotatedSigImg = await loadImage(rotatedDataUrl);

      if (fileType === 'pdf') {
        const fileBytes = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(sanitizePdfBytes(new Uint8Array(fileBytes)));
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];
        
        const { width: pdfWidth, height: pdfHeight } = firstPage.getSize();
        // Recalculate ratio based on pdf actual bounds, wait, pdf vs preview may differ if crop box etc. 
        // We'll trust ratioX from rendering to canvas. Actually to be safer, recalculate ratio against PDF size!
        const pdfRatioX = pdfWidth / previewImgRef.current.clientWidth;
        
        const pdfCx = Cx * pdfRatioX;
        const pdfCy = pdfHeight - (Cy * pdfRatioX);
        
        const pdfSigScaledWidth = sigNatWidth * sigScale * pdfRatioX;
        const pdfSigScaledHeight = sigNatHeight * sigScale * pdfRatioX;
        const pdfDiagScaled = Math.sqrt(pdfSigScaledWidth * pdfSigScaledWidth + pdfSigScaledHeight * pdfSigScaledHeight);

        // We embed the rasterized rotated signature
        const rotatedBytes = await fetch(rotatedDataUrl).then(r => r.arrayBuffer());
        const embedImg = await pdfDoc.embedPng(rotatedBytes);

        firstPage.drawImage(embedImg, {
          x: pdfCx - (pdfDiagScaled / 2),
          y: pdfCy - (pdfDiagScaled / 2),
          width: pdfDiagScaled,
          height: pdfDiagScaled
        });

        const pdfBytesSaved = await pdfDoc.save();
        downloadBlob(new Blob([pdfBytesSaved], { type: 'application/pdf' }), file.name.replace('.pdf', '_signed.pdf'));
        
      } else {
        // Image processing
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = bgImg.naturalWidth;
        finalCanvas.height = bgImg.naturalHeight;
        const ctx = finalCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(bgImg, 0, 0);
          
          const actualCx = Cx * ratioX;
          const actualCy = Cy * ratioX;
          
          ctx.drawImage(rotatedSigImg, actualCx - (diagScaled / 2), actualCy - (diagScaled / 2), diagScaled, diagScaled);
          
          const format = file.type || 'image/jpeg';
          const ext = format === 'image/png' ? 'png' : 'jpg';
          downloadBlob(await (await fetch(finalCanvas.toDataURL(format, 0.9))).blob(), file.name.replace(/\.[^/.]+$/, `_signed.${ext}`));
        }
      }
      
      // reset
      setStage('UPLOAD');
      setFile(null);
    } catch (e) {
      console.error(e);
      alert('Failed to save file.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col pt-4 animate-in fade-in slide-in-from-bottom-4 duration-300 h-full">
      <div className="liquid-panel rounded-[24px] overflow-hidden flex flex-col items-center flex-1 shadow-lg shadow-black/5">
        
        {stage === 'UPLOAD' && (
          <div className="w-full p-10 flex flex-col items-center justify-center flex-1">
            <div className="text-center mb-8">
               <div className="w-20 h-20 liquid-panel rounded-[24px] text-rose-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-rose-500/10">
                 <PenTool className="w-10 h-10" />
               </div>
               <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Sign Documents & Images</h2>
               <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md font-medium">Add digital signatures to your PDF and Image files.</p>
            </div>

            <div 
              {...getRootProps()} 
              className={`w-full max-w-xl mx-auto liquid-panel rounded-[24px] p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 pointer-events-auto ${
                isDragActive ? 'scale-[1.02] bg-rose-50/50 dark:bg-rose-900/20 border-rose-400' : 'hover:bg-white/40 dark:hover:bg-white/5 border-dashed border-2 border-rose-200 dark:border-rose-800/50'
              }`}
            >
              <input {...getInputProps()} />
              <UploadCloud className={`w-12 h-12 mb-4 transition-colors ${isDragActive ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'}`} />
              <p className="text-lg font-bold text-slate-700 dark:text-slate-200">Upload document or image</p>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">Supports PDF, PNG, JPG, WEBP</p>
            </div>
            
            {isProcessing && (
              <div className="mt-8 flex items-center gap-2 text-rose-600 font-bold">
                <Loader2 className="w-5 h-5 animate-spin"/> Processing...
              </div>
            )}
          </div>
        )}

        {stage === 'DRAW' && (
          <div className="w-full max-w-xl p-10 flex flex-col animate-in slide-in-from-bottom-4 flex-1">
            <div className="flex items-center gap-4 mb-8">
              <button onClick={() => setStage('UPLOAD')} className="p-2 liquid-btn-secondary rounded-xl text-slate-600 dark:text-slate-300">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Draw your signature</h3>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">You can position and scale it in the next step.</p>
              </div>
            </div>
            
            <div className="flex justify-between items-center mb-3 px-2">
               <span className="text-sm font-bold text-slate-400 dark:text-slate-500">Sign below</span>
               <button onClick={clearCanvas} className="text-sm text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 font-bold liquid-btn-secondary px-3 py-1.5 rounded-lg transition-colors">
                 <Eraser className="w-4 h-4" /> Clear
               </button>
            </div>
            
            <div className="liquid-panel border-2 border-white/20 dark:border-black/20 rounded-[24px] shadow-inner mb-8 relative overflow-hidden" style={{ touchAction: 'none' }}>
              <div className="absolute top-1/2 left-0 w-full h-px border-b-2 border-dashed border-slate-300 dark:border-slate-600 -translate-y-1/2 pointer-events-none opacity-50"></div>
              <canvas
                ref={drawCanvasRef}
                width={550}
                height={250}
                className="w-full h-[250px] cursor-crosshair relative z-10 block mix-blend-multiply dark:mix-blend-normal bg-white/50 dark:bg-black/20"
                onMouseDown={startDrawing}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
                onMouseMove={draw}
                onTouchStart={startDrawing}
                onTouchEnd={stopDrawing}
                onTouchMove={draw}
              />
            </div>
            
            <button 
              onClick={finishDrawing} 
              className="w-full py-4 liquid-btn text-white rounded-[16px] font-bold text-lg"
              style={{ background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(2, 6, 23, 1))' }}
            >
              Apply to Document
            </button>
          </div>
        )}

        {stage === 'POSITION' && (
          <div className="w-full flex-1 flex flex-col overflow-hidden relative">
            <div className="bg-white/40 dark:bg-black/20 border-b border-black/5 dark:border-white/10 px-6 py-4 flex items-center justify-between shrink-0 z-20 relative">
              <div className="flex items-center gap-4">
                <button onClick={() => setStage('DRAW')} className="p-2 liquid-btn-secondary rounded-xl text-slate-600 dark:text-slate-300 transition-colors">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h3 className="font-bold text-lg text-slate-800 dark:text-white">Position Signature</h3>
              </div>
              
              <button 
                onClick={saveFile} 
                disabled={isProcessing}
                className="px-6 py-2.5 liquid-btn text-white rounded-[12px] font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, rgba(225, 29, 72, 0.9), rgba(190, 18, 60, 1))', boxShadow: '0 4px 12px rgba(190, 18, 60, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.4)' }}
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5"/>}
                Save
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-slate-100/50 dark:bg-black/40 relative p-4 lg:p-8 flex items-start justify-center shadow-inner pt-6">
               <div 
                 ref={previewFrameRef}
                 className="relative shadow-2xl rounded-sm overflow-hidden ring-1 ring-black/5" 
                 style={{ maxWidth: '100%', display: 'inline-block' }}
               >
                 <img 
                   ref={previewImgRef}
                   src={previewUrl} 
                   alt="Document Preview" 
                   className="block w-full h-auto pointer-events-none"
                   style={{ maxWidth: '800px' }}
                 />
                 
                 <div
                   style={{
                     position: 'absolute',
                     left: sigPos.x,
                     top: sigPos.y,
                     cursor: isDraggingSig ? 'grabbing' : 'grab',
                     touchAction: 'none',
                     border: isDraggingSig ? '2px dashed rgba(225, 29, 72, 0.5)' : '2px dashed rgba(0,0,0,0.1)',
                     borderRadius: '8px',
                     padding: '4px',
                     backgroundColor: 'transparent',
                     zIndex: 10,
                     width: 'max-content',
                     height: 'max-content'
                   }}
                   onPointerDown={handlePointerDown}
                   onPointerMove={handlePointerMove}
                   onPointerUp={handlePointerUp}
                 >
                   <img 
                     src={signatureDataUrl} 
                     draggable={false} 
                     style={{ 
                       pointerEvents: 'none', 
                       transform: `scale(${sigScale}) rotate(${sigRotation}deg)`,
                       transformOrigin: 'center',
                       display: 'block',
                       maxWidth: 'none'
                     }} 
                   />
                 </div>
               </div>
            </div>

            <div className="liquid-panel border-t border-black/5 dark:border-white/10 px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-8 z-20 shrink-0">
               <div className="bg-white/40 dark:bg-black/20 p-4 rounded-2xl shadow-sm border border-black/5 dark:border-white/10">
                 <div className="flex justify-between text-sm font-bold mb-4">
                   <span className="text-slate-800 dark:text-slate-200">Size</span>
                   <span className="text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-black/40 px-2 py-0.5 rounded-full">{Math.round(sigScale * 100)}%</span>
                 </div>
                 <input 
                   type="range" 
                   min="0.1" 
                   max="2.0" 
                   step="0.05" 
                   value={sigScale} 
                   onChange={(e) => setSigScale(parseFloat(e.target.value))}
                   className="w-full accent-rose-500 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                 />
               </div>
               <div className="bg-white/40 dark:bg-black/20 p-4 rounded-2xl shadow-sm border border-black/5 dark:border-white/10">
                 <div className="flex justify-between text-sm font-bold mb-4">
                   <span className="text-slate-800 dark:text-slate-200">Rotation</span>
                   <span className="text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-black/40 px-2 py-0.5 rounded-full">{sigRotation}°</span>
                 </div>
                 <input 
                   type="range" 
                   min="-180" 
                   max="180" 
                   step="1" 
                   value={sigRotation} 
                   onChange={(e) => setSigRotation(parseFloat(e.target.value))}
                   className="w-full accent-rose-500 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                 />
               </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
