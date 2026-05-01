import React, { useState, useRef, useEffect } from 'react';
import { Camera, FileDown, Plus, X, SlidersHorizontal, Image as ImageIcon } from 'lucide-react';
import { jsPDF } from 'jspdf';

interface ScannedImage {
  id: string;
  original: string;
  filtered: string;
  filter: 'none' | 'grayscale' | 'bw' | 'enhance';
}

export function ScanTool() {
  const [images, setImages] = useState<ScannedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    Array.from(files as unknown as File[]).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result && typeof e.target.result === 'string') {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_DIMENSION = 1500;
            if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
              if (width > height) {
                height = (height / width) * MAX_DIMENSION;
                width = MAX_DIMENSION;
              } else {
                width = (width / height) * MAX_DIMENSION;
                height = MAX_DIMENSION;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
               ctx.fillStyle = '#ffffff';
               ctx.fillRect(0, 0, canvas.width, canvas.height);
               ctx.drawImage(img, 0, 0, width, height);
               const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
               const newId = Math.random().toString(36).substring(7);
               setImages(prev => [...prev, {
                 id: newId,
                 original: dataUrl,
                 filtered: dataUrl,
                 filter: 'none'
               }]);
               setActiveImageId(newId);
            }
          };
          img.src = e.target.result as string;
        }
      };
      reader.readAsDataURL(file);
    });
    
    // Reset file inputs
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const applyFilter = (imgObj: ScannedImage, filterType: ScannedImage['filter']) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Apply filters
      if (filterType === 'none') {
        ctx.filter = 'none';
      } else if (filterType === 'grayscale') {
        ctx.filter = 'grayscale(100%)';
      } else if (filterType === 'bw') {
        ctx.filter = 'grayscale(100%) contrast(200%) brightness(1.2)';
      } else if (filterType === 'enhance') {
        ctx.filter = 'contrast(120%) brightness(1.1) saturate(1.2)';
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const newFiltered = canvas.toDataURL('image/jpeg', 0.8);

      setImages(prev => prev.map(item => 
        item.id === imgObj.id 
          ? { ...item, filtered: newFiltered, filter: filterType } 
          : item
      ));
    };
    img.src = imgObj.original;
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      if (activeImageId === id) {
         setActiveImageId(filtered.length > 0 ? filtered[filtered.length - 1].id : null);
      }
      return filtered;
    });
  };

  const generatePDF = async () => {
    if (images.length === 0) return;
    setIsGenerating(true);

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (let index = 0; index < images.length; index++) {
        const imgObj = images[index];
        if (index > 0) pdf.addPage();
        
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
             const ratio = img.width / img.height;
             
             let renderWidth = pageWidth;
             let renderHeight = renderWidth / ratio;
             
             if (renderHeight > pageHeight) {
               renderHeight = pageHeight;
               renderWidth = renderHeight * ratio;
             }
             
             const x = (pageWidth - renderWidth) / 2;
             const y = (pageHeight - renderHeight) / 2;
             
             try {
                pdf.addImage(imgObj.filtered, 'JPEG', x, y, renderWidth, renderHeight);
                resolve();
             } catch (err) {
                reject(err);
             }
          };
          img.onerror = () => reject(new Error("Failed to load image for PDF generation"));
          img.src = imgObj.filtered;
        });
      }

      pdf.save('Scanned_Document.pdf');
    } catch (e) {
      console.error("Error generating PDF", e);
      alert("Failed to generate PDF. See console for details.");
    } finally {
      setIsGenerating(false);
    }
  };

  const activeImage = images.find(img => img.id === activeImageId);

  return (
    <div className="flex-1 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col xl:flex-row flex-1">
        
        {/* Left Side: Viewer & Actions */}
        <div className="flex-1 border-b xl:border-b-0 xl:border-r border-slate-200 bg-slate-900 p-6 flex flex-col relative min-h-[400px]">
          <h3 className="text-white font-medium mb-4 flex items-center justify-between">
             <span className="flex items-center gap-2"><Camera className="w-5 h-5 text-indigo-400" /> Document Scanner</span>
             
             {/* Hidden File Input for Native Camera */}
             <input 
               type="file" 
               accept="image/*" 
               capture="environment" 
               ref={cameraInputRef} 
               onChange={handleCapture}
               className="hidden" 
             />
             
             {/* Hidden File Input for Gallery */}
             <input 
               type="file" 
               accept="image/*" 
               ref={galleryInputRef} 
               onChange={handleCapture}
               className="hidden" 
               multiple
             />
             
             <div className="flex gap-2">
                 <button 
                   onClick={() => galleryInputRef.current?.click()}
                   className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                 >
                   <ImageIcon className="w-4 h-4" /> Add
                 </button>
                 <button 
                   onClick={() => cameraInputRef.current?.click()}
                   className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                 >
                   <Camera className="w-4 h-4" /> Capture New
                 </button>
             </div>
          </h3>
          
          <div className="flex-1 relative rounded-xl overflow-hidden bg-black flex items-center justify-center border border-slate-700">
             {activeImage ? (
                <>
                  <img src={activeImage.filtered} alt="Active Scan" className="absolute inset-0 w-full h-full object-contain" />
                  {/* Filters Overlay Panel */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-800/80 backdrop-blur-md px-4 py-2 rounded-full border border-slate-600 flex items-center gap-2">
                     {(['none', 'grayscale', 'bw', 'enhance'] as const).map(f => (
                       <button
                         key={f}
                         onClick={() => applyFilter(activeImage, f)}
                         className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                           activeImage.filter === f ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-slate-700'
                         }`}
                       >
                         {f === 'bw' ? 'B&W' : f}
                       </button>
                     ))}
                  </div>
                </>
             ) : (
                <div className="text-center">
                   <button 
                     onClick={() => cameraInputRef.current?.click()}
                     className="w-16 h-16 bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center text-slate-300 transition-transform hover:scale-105 mx-auto mb-4 border-2 border-slate-600 border-dashed"
                   >
                     <Plus className="w-8 h-8" />
                   </button>
                   <p className="text-slate-400 font-medium">Add Images or Capture Document</p>
                </div>
             )}
          </div>
          
          {/* Thumbnails */}
          {images.length > 0 && (
             <div className="mt-4 flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                {images.map((img, i) => (
                  <div 
                    key={img.id} 
                    className={`relative w-20 h-20 shrink-0 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                      activeImageId === img.id ? 'border-indigo-500' : 'border-transparent hover:border-slate-500'
                    }`}
                    onClick={() => setActiveImageId(img.id)}
                  >
                     <img src={img.filtered} className="w-full h-full object-cover" />
                     <div className="absolute top-1 right-1 bg-black/50 text-white text-[10px] px-1.5 rounded-sm">
                       {i + 1}
                     </div>
                     <button 
                       onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                       className="absolute bottom-1 right-1 bg-red-500/80 hover:bg-red-500 text-white p-1 rounded-full shadow-sm"
                     >
                        <X className="w-3 h-3" />
                     </button>
                  </div>
                ))}
             </div>
          )}
        </div>

        {/* Right Side: Generation Panel */}
        <div className="w-full xl:w-1/3 bg-slate-50 flex flex-col p-6">
           <div className="flex-1 flex flex-col items-center justify-center text-center">
             <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-6 border-4 border-white shadow-sm">
               <FileDown className="w-10 h-10 text-indigo-600" />
             </div>
             <h3 className="text-xl font-bold text-slate-800 mb-2">Generate PDF</h3>
             <p className="text-slate-500 mb-8 px-4">
               {images.length === 0 
                 ? "Capture documents using your camera to combine them into a single PDF file."
                 : `Ready to combine ${images.length} page${images.length > 1 ? 's' : ''} into a high-quality PDF document.`}
             </p>
             
             <button
               onClick={generatePDF}
               disabled={images.length === 0 || isGenerating}
               className="w-full max-w-xs py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl font-semibold shadow-md inline-flex items-center justify-center gap-2 transition"
             >
               {isGenerating ? 'Generating...' : 'Save to PDF'}
             </button>
           </div>
        </div>
      </div>
      
      {/* Hidden canvas for image manipulation */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
