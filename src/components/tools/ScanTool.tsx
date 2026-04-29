import React, { useState, useRef, useCallback } from 'react';
import { Camera, RefreshCw, ScanText, Loader2 } from 'lucide-react';
import Tesseract from 'tesseract.js';

export function ScanTool() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [cameraError, setCameraError] = useState('');

  const startCamera = async () => {
    try {
      setCameraError('');
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setCameraError('Unable to access camera. Please check permissions.');
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  React.useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      setCapturedImage(canvas.toDataURL('image/jpeg', 0.9));
      stopCamera();
    }
  };

  const processImage = async () => {
    if (!capturedImage) return;
    setIsProcessing(true);
    try {
      const result = await Tesseract.recognize(capturedImage, 'eng');
      setExtractedText(result.data.text || 'No text found.');
    } catch (error) {
       console.error(error);
       setExtractedText('Failed to process image.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col xl:flex-row flex-1">
        {/* Left: Camera / Preview */}
        <div className="flex-1 border-b xl:border-b-0 xl:border-r border-slate-200 bg-slate-900 p-6 flex flex-col relative min-h-[400px]">
          <h3 className="text-white font-medium mb-4 flex items-center gap-2">
             <Camera className="w-5 h-5 text-indigo-400" /> Document Scanner
          </h3>
          <div className="flex-1 relative rounded-xl overflow-hidden bg-black flex items-center justify-center border border-slate-700">
            {cameraError ? (
              <div className="text-slate-400 text-center p-6 bg-black">
                <p>{cameraError}</p>
                <button onClick={startCamera} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg">Try Again</button>
              </div>
            ) : !stream && !capturedImage ? (
              <div className="text-center">
                 <button onClick={startCamera} className="w-16 h-16 bg-indigo-600 hover:bg-indigo-500 rounded-full flex items-center justify-center text-white transition-transform hover:scale-105 mx-auto mb-4">
                   <Camera className="w-6 h-6" />
                 </button>
                 <p className="text-slate-400 font-medium">Click to Start Camera</p>
              </div>
            ) : (
              <>
                <video ref={videoRef} autoPlay playsInline muted className={`absolute inset-0 w-full h-full object-cover ${capturedImage ? 'hidden' : 'block'}`} />
                {capturedImage && <img src={capturedImage} alt="Captured" className="absolute inset-0 w-full h-full object-contain bg-slate-900" />}
              </>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
          
          {stream && !capturedImage && (
            <div className="mt-6 flex justify-center">
              <button 
                onClick={captureImage}
                className="w-16 h-16 rounded-full bg-white border-4 border-slate-400 hover:bg-slate-200 transition-colors shadow-[0_0_0_4px_rgba(255,255,255,0.2)]"
              />
            </div>
          )}

          {capturedImage && (
            <div className="mt-6 flex gap-4">
               <button onClick={() => { setCapturedImage(null); startCamera(); }} className="flex-1 py-3 bg-slate-800 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-slate-700 transition">
                 <RefreshCw className="w-4 h-4" /> Retake
               </button>
               <button onClick={processImage} disabled={isProcessing} className="flex-1 py-3 bg-indigo-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-500 transition disabled:opacity-50">
                 {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanText className="w-4 h-4" />} Digitize
               </button>
            </div>
          )}
        </div>

        {/* Right: Results text area */}
        <div className="flex-[0.8] p-6 bg-slate-50 flex flex-col">
           <h3 className="text-slate-800 font-medium mb-4 flex items-center justify-between">Transcription Result</h3>
           <div className="flex-1 bg-white border border-slate-200 rounded-xl relative overflow-hidden">
              {isProcessing && (
                <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex flex-col justify-center items-center">
                   <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
                   <p className="font-medium text-slate-700">Digitalizing Text...</p>
                </div>
              )}
              <textarea
                value={extractedText}
                onChange={(e) => setExtractedText(e.target.value)}
                placeholder="Captured text will appear here. You can edit it directly."
                className="w-full h-full p-6 outline-none resize-none leading-relaxed text-slate-700"
                disabled={isProcessing}
              />
           </div>
        </div>
      </div>
    </div>
  );
}
