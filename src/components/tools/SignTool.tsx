import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, PenTool, Eraser, Download, Loader2, ArrowLeft } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { downloadBlob } from '../../lib/utils';
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
          const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: ctx, viewport }).promise;
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
        const pdfDoc = await PDFDocument.load(fileBytes);
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
    <div className="flex-1 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col items-center flex-1">
        
        {stage === 'UPLOAD' && (
          <div className="w-full p-10 flex flex-col items-center justify-center flex-1">
            <div className="text-center mb-8">
               <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
                 <PenTool className="w-6 h-6" />
               </div>
               <h2 className="text-2xl font-bold text-slate-800">Sign Documents & Images</h2>
               <p className="text-slate-500 mt-2 max-w-md">Add digital signatures to your PDF and Image files.</p>
            </div>

            <div 
              {...getRootProps()} 
              className={`w-full max-w-xl border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-rose-500 bg-rose-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50'
              }`}
            >
              <input {...getInputProps()} />
              <UploadCloud className="w-12 h-12 mb-4 text-slate-400" />
              <p className="text-lg font-medium text-slate-700">Upload document or image</p>
              <p className="text-sm text-slate-500 mt-2">Supports PDF, PNG, JPG, WEBP</p>
            </div>
            
            {isProcessing && (
              <div className="mt-8 flex items-center gap-2 text-rose-600 font-medium">
                <Loader2 className="w-5 h-5 animate-spin"/> Processing...
              </div>
            )}
          </div>
        )}

        {stage === 'DRAW' && (
          <div className="w-full max-w-xl p-10 flex flex-col animate-in slide-in-from-bottom-4 flex-1">
            <div className="flex items-center gap-4 mb-8">
              <button onClick={() => setStage('UPLOAD')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Draw your signature</h3>
                <p className="text-sm text-slate-500">You can position and scale it in the next step.</p>
              </div>
            </div>
            
            <div className="flex justify-between items-center mb-3 px-1">
               <span className="text-sm font-medium text-slate-400">Sign below</span>
               <button onClick={clearCanvas} className="text-sm text-slate-500 hover:text-rose-600 flex items-center gap-1 font-medium bg-slate-100 hover:bg-rose-50 px-3 py-1 rounded-md transition-colors">
                 <Eraser className="w-4 h-4" /> Clear
               </button>
            </div>
            
            <div className="border-2 border-slate-200 rounded-xl bg-slate-50 shadow-inner mb-8 relative overflow-hidden" style={{ touchAction: 'none' }}>
              <div className="absolute top-1/2 left-0 w-full h-px border-b-2 border-dashed border-slate-200 -translate-y-1/2 pointer-events-none opacity-50"></div>
              <canvas
                ref={drawCanvasRef}
                width={550}
                height={250}
                className="w-full h-[250px] cursor-crosshair relative z-10 block"
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
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium shadow-md transition-all text-lg"
            >
              Apply to Document
            </button>
          </div>
        )}

        {stage === 'POSITION' && (
          <div className="w-full flex-1 flex flex-col overflow-hidden relative">
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 z-20 relative shadow-sm">
              <div className="flex items-center gap-4">
                <button onClick={() => setStage('DRAW')} className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h3 className="font-semibold text-slate-800">Position Signature</h3>
              </div>
              
              <button 
                onClick={saveFile} 
                disabled={isProcessing}
                className="px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white shadow-md rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4"/>}
                Save
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-slate-200 relative p-4 lg:p-8 flex items-start justify-center">
               <div 
                 ref={previewFrameRef}
                 className="relative shadow-xl bg-white select-none overflow-hidden" 
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

            <div className="bg-white border-t border-slate-200 px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-6 z-20 shrink-0">
               <div>
                 <div className="flex justify-between text-sm font-medium mb-2">
                   <span className="text-slate-700">Size</span>
                   <span className="text-slate-500">{Math.round(sigScale * 100)}%</span>
                 </div>
                 <input 
                   type="range" 
                   min="0.1" 
                   max="2.0" 
                   step="0.05" 
                   value={sigScale} 
                   onChange={(e) => setSigScale(parseFloat(e.target.value))}
                   className="w-full accent-rose-600"
                 />
               </div>
               <div>
                 <div className="flex justify-between text-sm font-medium mb-2">
                   <span className="text-slate-700">Rotation</span>
                   <span className="text-slate-500">{sigRotation}°</span>
                 </div>
                 <input 
                   type="range" 
                   min="-180" 
                   max="180" 
                   step="1" 
                   value={sigRotation} 
                   onChange={(e) => setSigRotation(parseFloat(e.target.value))}
                   className="w-full accent-rose-600"
                 />
               </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
