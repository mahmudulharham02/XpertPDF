import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, PenTool, Eraser, Download, DownloadCloud, Loader2 } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { downloadBlob } from '../../lib/utils';

export function SignTool() {
  const [file, setFile] = useState<File | null>(null);
  const [signatureMode, setSignatureMode] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1
  } as any);

  // Canvas drawing logic
  useEffect(() => {
    if (!signatureMode || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a'; // slate-900

  }, [signatureMode]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) ctx.beginPath(); // Reset path for next stroke
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
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

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignatureAndSimulate = async () => {
    if (!canvasRef.current || !file) return;
    
    setIsProcessing(true);
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const signatureBytes = await fetch(dataUrl).then(res => res.arrayBuffer());
      
      const fileBytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(fileBytes);
      const signatureImage = await pdfDoc.embedPng(signatureBytes);
      
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();
      
      const dims = signatureImage.scale(0.5); // scale down
      
      // Draw signature at the bottom center of the first page
      firstPage.drawImage(signatureImage, {
        x: width / 2 - dims.width / 2,
        y: 50,
        width: dims.width,
        height: dims.height,
      });
      
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      downloadBlob(blob, file.name.replace('.pdf', '_signed.pdf'));
      
      setSignatureMode(false);
      setFile(null); // Reset after successful signing
    } catch (error) {
      console.error(error);
      alert('Failed to apply signature to PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col items-center p-10">
        
        <div className="text-center mb-8">
           <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
             <PenTool className="w-6 h-6" />
           </div>
           <h2 className="text-2xl font-bold text-slate-800">Sign Documents</h2>
           <p className="text-slate-500 mt-2 max-w-md">Add legally binding digital signatures directly in your browser securely.</p>
        </div>

        {!file ? (
          <div 
            {...getRootProps()} 
            className={`w-full max-w-xl border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-rose-500 bg-rose-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50'
            }`}
          >
            <input {...getInputProps()} />
            <UploadCloud className="w-12 h-12 mb-4 text-slate-400" />
            <p className="text-lg font-medium text-slate-700">Upload document to sign</p>
            <p className="text-sm text-slate-500 mt-2">Only PDF files are supported</p>
          </div>
        ) : !signatureMode ? (
          <div className="w-full max-w-xl border rounded-xl p-6 bg-slate-50 border-slate-200 text-center relative overflow-hidden group">
            <h3 className="font-semibold text-lg text-slate-900 truncate mb-1 px-8">{file.name}</h3>
            <p className="text-sm text-slate-500 mb-6 font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            
            <div className="flex justify-center gap-4">
               <button onClick={() => setSignatureMode(true)} className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium flex items-center gap-2 shadow-sm transition-colors">
                 <PenTool className="w-4 h-4" /> Draw Signature
               </button>
               <button onClick={() => setFile(null)} className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium transition-colors">
                 Cancel
               </button>
            </div>
            
            {/* Visual Flair */}
            <div className="absolute opacity-5 -bottom-10 -right-10 pointer-events-none group-hover:rotate-12 transition-transform duration-700">
               <PenTool className="w-64 h-64" />
            </div>
          </div>
        ) : (
          <div className="w-full max-w-xl flex flex-col animate-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center mb-3 px-1">
               <h3 className="font-medium text-slate-700">Draw your signature below</h3>
               <button onClick={clearCanvas} className="text-sm text-slate-500 hover:text-rose-600 flex items-center gap-1">
                 <Eraser className="w-4 h-4" /> Clear
               </button>
            </div>
            
            <div className="border-2 border-slate-200 rounded-xl bg-white shadow-inner mb-6 relative overflow-hidden" style={{ touchAction: 'none' }}>
              <div className="absolute top-1/2 left-0 w-full h-px border-b border-dashed border-slate-200 -translate-y-1/2 pointer-events-none opacity-50"></div>
              <canvas
                ref={canvasRef}
                width={550}
                height={250}
                className="w-full h-[250px] cursor-crosshair bg-transparent relative z-10"
                onMouseDown={startDrawing}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
                onMouseMove={draw}
                onTouchStart={startDrawing}
                onTouchEnd={stopDrawing}
                onTouchMove={draw}
              />
            </div>
            
            <div className="flex gap-4">
               <button 
                 onClick={saveSignatureAndSimulate} 
                 disabled={isProcessing}
                 className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
               >
                 {isProcessing ? (
                   <Loader2 className="w-5 h-5 animate-spin" />
                 ) : (
                   <DownloadCloud className="w-5 h-5"/> 
                 )}
                 {isProcessing ? 'Applying...' : 'Apply to Document'}
               </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
