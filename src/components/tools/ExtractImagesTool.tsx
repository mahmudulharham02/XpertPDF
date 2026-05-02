import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Image as ImageIcon, DownloadCloud } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// @ts-expect-error Vite handles this
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export function ExtractImagesTool() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedImages, setExtractedImages] = useState<string[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setExtractedImages([]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1
  } as any);

  const handleExtract = async () => {
    if (!file) return;
    setIsProcessing(true);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      const extracted: string[] = [];
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const ops = await page.getOperatorList();
        
        for (let j = 0; j < ops.fnArray.length; j++) {
          if (
            ops.fnArray[j] === pdfjsLib.OPS.paintImageXObject || 
            ops.fnArray[j] === pdfjsLib.OPS.paintJpegXObject ||
            ops.fnArray[j] === pdfjsLib.OPS.paintInlineImageXObject
          ) {
            try {
              let img: any;

              if (ops.fnArray[j] === pdfjsLib.OPS.paintInlineImageXObject) {
                img = ops.argsArray[j][0];
              } else {
                const imgName = ops.argsArray[j][0];
                try {
                  img = page.objs.get(imgName);
                } catch (e) {
                  console.warn("Failed to get object from page.objs", e);
                }
              }

              if (!img) continue;

              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              if (!ctx) continue;

              if (img instanceof HTMLImageElement || img instanceof HTMLCanvasElement || img instanceof ImageBitmap) {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img as CanvasImageSource, 0, 0);
                extracted.push(canvas.toDataURL('image/png'));
              } else if (img.bitmap) {
                // If it's an ImageBitmap wrapping object
                canvas.width = img.bitmap.width;
                canvas.height = img.bitmap.height;
                ctx.drawImage(img.bitmap, 0, 0);
                extracted.push(canvas.toDataURL('image/png'));
              } else if (img.data && typeof img.width === 'number' && typeof img.height === 'number') {
                // If it's raw pixel data
                canvas.width = img.width;
                canvas.height = img.height;
                
                let imageData: ImageData | null = null;
                const dataLength = img.data.length;
                const expectedPixels = img.width * img.height;

                if (dataLength === expectedPixels * 4) {
                  imageData = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
                } else if (dataLength === expectedPixels * 3) {
                  const rgba = new Uint8ClampedArray(expectedPixels * 4);
                  for (let p = 0, q = 0; p < dataLength; p += 3, q += 4) {
                    rgba[q] = img.data[p];
                    rgba[q + 1] = img.data[p + 1];
                    rgba[q + 2] = img.data[p + 2];
                    rgba[q + 3] = 255;
                  }
                  imageData = new ImageData(rgba, img.width, img.height);
                } else if (dataLength === expectedPixels) {
                  const rgba = new Uint8ClampedArray(expectedPixels * 4);
                  for (let p = 0, q = 0; p < dataLength; p += 1, q += 4) {
                    const luma = img.data[p];
                    rgba[q] = luma;
                    rgba[q + 1] = luma;
                    rgba[q + 2] = luma;
                    rgba[q + 3] = 255;
                  }
                  imageData = new ImageData(rgba, img.width, img.height);
                }

                if (imageData) {
                  ctx.putImageData(imageData, 0, 0);
                  extracted.push(canvas.toDataURL('image/png'));
                }
              }
            } catch (err) {
              console.warn('Failed to extract an image from PDF', err);
            }
          }
        }
      }
      
      setExtractedImages(extracted);
    } catch (error) {
      console.error('Error extracting images:', error);
      alert('Failed to extract images from PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col pt-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="liquid-panel rounded-[24px] overflow-hidden flex flex-col lg:flex-row flex-1">
        
        {/* Left Side: Upload */}
        <div className="w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r border-black/5 dark:border-white/10 bg-white/30 dark:bg-black/20 p-6 flex flex-col gap-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-1">Source Target</h3>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Upload PDF to pull graphs & images.</p>
          </div>

          <div {...getRootProps()} className={`border-2 border-dashed rounded-[20px] p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${isDragActive ? 'border-purple-500 bg-purple-500/10 scale-[1.02]' : 'border-purple-200 dark:border-purple-900/50 hover:bg-white/40 dark:hover:bg-white/5 bg-white/20 dark:bg-black/20'}`}>
            <input {...getInputProps()} />
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${isDragActive ? 'bg-purple-100 dark:bg-purple-900/40' : 'bg-purple-50 dark:bg-purple-900/20'}`}>
               <UploadCloud className={`w-8 h-8 ${isDragActive ? 'text-purple-600 dark:text-purple-400' : 'text-purple-500 dark:text-purple-400'}`} />
            </div>
            {file ? (
              <div className="flex flex-col items-center">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate max-w-full px-4">{file.name}</p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{(file.size/1024/1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <>
                 <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Drop PDF here to scan</p>
                 <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Or click to browse files</p>
              </>
            )}
          </div>

          <button
            onClick={handleExtract}
            disabled={!file || isProcessing}
            className={`w-full py-4 rounded-[16px] font-semibold flex items-center justify-center gap-2 transition-all ${!file || isProcessing ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 opacity-60' : 'liquid-btn'}`}
          >
            {isProcessing ? 'Scanning pages...' : 'Extract All Images'}
          </button>
        </div>

        {/* Right Side: Results */}
        <div className="flex-1 p-6 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                 <ImageIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              Extracted Assets
            </h3>
            {extractedImages.length > 0 && <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 text-xs px-3 py-1.5 rounded-full font-semibold">{extractedImages.length} found</span>}
          </div>
          
          {extractedImages.length === 0 ? (
             <div className="text-center text-slate-500 dark:text-slate-400 my-auto p-12 mt-12 bg-white/20 dark:bg-black/10 rounded-[24px] border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <ImageIcon className="w-10 h-10 opacity-50" />
                </div>
                <p className="font-semibold text-slate-700 dark:text-slate-300">No Images Detected in this PDF.</p>
                <p className="text-sm font-medium mt-2 opacity-80">(There is no recognizable graphical files!)</p>
             </div>
          ) : (
             <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
               {extractedImages.map((src, i) => (
                 <div key={i} className="group relative bg-white/40 dark:bg-black/20 border border-white/40 dark:border-white/10 rounded-[20px] overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                    <div className="aspect-[4/3] w-full p-2">
                       <img src={src} className="w-full h-full object-contain rounded-xl bg-black/5 dark:bg-white/5" alt={`Extract ${i}`} />
                    </div>
                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                       <button 
                          onClick={async () => {
                            try {
                              const response = await fetch(src);
                              const blob = await response.blob();
                              
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `extracted_image_${i + 1}.png`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            } catch (error) {
                              console.error("Download failed, opening in new tab", error);
                              window.open(src, '_blank');
                            }
                          }}
                          className="liquid-btn px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-2"
                       >
                          <DownloadCloud className="w-4 h-4" /> Save PNG
                       </button>
                    </div>
                 </div>
               ))}
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
