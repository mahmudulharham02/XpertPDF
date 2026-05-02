import React, { useState, useRef, useEffect } from 'react';
import { Camera, FileDown, Plus, X, SlidersHorizontal, Image as ImageIcon } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { downloadBlob } from '../../lib/utils';

interface ScannedImage {
  id: string;
  original: string;
  filtered: string;
  filter: 'none' | 'grayscale' | 'bw' | 'enhance';
  width: number;
  height: number;
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
                 filter: 'none',
                 width,
                 height
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

  const generatePDF = () => {
    if (images.length === 0) return;
    setIsGenerating(true);

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (let index = 0; index < images.length; index++) {
        const imgObj = images[index];
        if (index > 0) pdf.addPage();
        
        const ratio = imgObj.width / imgObj.height;
        
        let renderWidth = pageWidth;
        let renderHeight = renderWidth / ratio;
        
        if (renderHeight > pageHeight) {
          renderHeight = pageHeight;
          renderWidth = renderHeight * ratio;
        }
        
        const x = (pageWidth - renderWidth) / 2;
        const y = (pageHeight - renderHeight) / 2;
        
        pdf.addImage(imgObj.filtered, 'JPEG', x, y, renderWidth, renderHeight);
      }

      const blob = pdf.output('blob');
      downloadBlob(blob, 'Scanned_Document.pdf');
    } catch (e) {
      console.error("Error generating PDF", e);
      alert("Failed to generate PDF. See console for details.");
    } finally {
      setIsGenerating(false);
    }
  };

  const activeImage = images.find(img => img.id === activeImageId);

  return (
    <div className="flex-1 flex flex-col pt-4 animate-in fade-in slide-in-from-bottom-4 duration-300 h-full">
      <div className="liquid-panel rounded-[24px] overflow-hidden flex flex-col xl:flex-row flex-1 shadow-lg shadow-black/5">
        
        {/* Left Side: Viewer & Actions */}
        <div className="flex-1 border-b xl:border-b-0 xl:border-r border-black/5 dark:border-white/10 p-6 flex flex-col relative min-h-[400px]">
          <h3 className="text-slate-800 dark:text-white font-semibold mb-4 flex items-center justify-between">
             <span className="flex items-center gap-2"><Camera className="w-5 h-5 text-indigo-500" /> Document Scanner</span>
             
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
                   className="liquid-btn-secondary px-3 py-1.5 font-medium flex items-center gap-1 text-sm bg-white/40 dark:bg-black/20"
                 >
                   <ImageIcon className="w-4 h-4" /> Add
                 </button>
                 <button 
                   onClick={() => cameraInputRef.current?.click()}
                   className="liquid-btn px-4 py-1.5 text-sm flex items-center gap-1 shadow-md shadow-indigo-500/20"
                   style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(79, 70, 229, 1))', color: 'white' }}
                 >
                   <Camera className="w-4 h-4" /> Capture New
                 </button>
             </div>
          </h3>
          
          <div className="flex-1 relative rounded-[20px] overflow-hidden bg-slate-100/50 dark:bg-black/40 flex items-center justify-center border border-black/5 dark:border-white/10 shadow-inner">
             {activeImage ? (
                <>
                  <img src={activeImage.filtered} alt="Active Scan" className="absolute inset-0 w-full h-full object-contain drop-shadow-md" />
                  {/* Filters Overlay Panel */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 liquid-panel bg-white/60 dark:bg-slate-800/60 px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
                     {(['none', 'grayscale', 'bw', 'enhance'] as const).map(f => (
                       <button
                         key={f}
                         onClick={() => applyFilter(activeImage, f)}
                         className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all duration-300 ${
                           activeImage.filter === f ? 'bg-indigo-500 text-white shadow-md scale-105' : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-white/10 hover:scale-105'
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
                     className="w-20 h-20 bg-white/50 dark:bg-black/20 hover:bg-white/80 dark:hover:bg-black/40 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500 transition-all hover:scale-105 hover:shadow-lg mx-auto mb-4 border-2 border-dashed border-indigo-200 dark:border-indigo-900/50 hover:border-indigo-400"
                   >
                     <Plus className="w-8 h-8" />
                   </button>
                   <p className="text-slate-500 dark:text-slate-400 font-semibold">Add Images or Capture Document</p>
                </div>
             )}
          </div>
          
          {/* Thumbnails */}
          {images.length > 0 && (
             <div className="mt-6 flex gap-4 overflow-x-auto pb-2 custom-scrollbar px-2">
                {images.map((img, i) => (
                  <div 
                    key={img.id} 
                    className={`relative w-24 h-24 shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 ${
                      activeImageId === img.id ? 'ring-2 ring-indigo-500 shadow-lg scale-105' : 'shadow-sm opacity-80 hover:opacity-100 hover:scale-105'
                    }`}
                    onClick={() => setActiveImageId(img.id)}
                  >
                     <img src={img.filtered} className="w-full h-full object-cover" />
                     <div className="absolute top-1 right-1 bg-black/60 text-white font-bold text-[10px] px-2 py-0.5 rounded-full">
                       {i + 1}
                     </div>
                     <button 
                       onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                       className="absolute bottom-1 right-1 bg-rose-500/90 hover:bg-rose-600 text-white p-1.5 rounded-full shadow-md transition-transform hover:scale-110"
                     >
                        <X className="w-3.5 h-3.5" />
                     </button>
                  </div>
                ))}
             </div>
          )}
        </div>

        {/* Right Side: Generation Panel */}
        <div className="w-full xl:w-1/3 p-8 flex flex-col relative overflow-hidden">
           <div className="absolute inset-0 bg-white/20 dark:bg-black/10 pointer-events-none" />
           <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10">
             <div className="w-24 h-24 liquid-panel rounded-[24px] flex items-center justify-center mb-8 border border-white/40 shadow-xl shadow-indigo-500/10">
               <FileDown className="w-12 h-12 text-indigo-500" />
             </div>
             <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">Generate PDF</h3>
             <p className="text-slate-500 dark:text-slate-400 mb-10 px-4 font-medium leading-relaxed">
               {images.length === 0 
                 ? "Capture documents using your camera to combine them into a single PDF file."
                 : `Ready to combine ${images.length} page${images.length > 1 ? 's' : ''} into a high-quality PDF document.`}
             </p>
             
             <button
               onClick={generatePDF}
               disabled={images.length === 0 || isGenerating}
               className={`w-full max-w-xs py-4 rounded-[16px] font-bold text-lg inline-flex items-center justify-center gap-2 transition-all duration-300 ${
                 images.length === 0 || isGenerating ? 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed' : 'liquid-btn'
               }`}
               style={images.length > 0 && !isGenerating ? { background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(79, 70, 229, 1))', color: 'white', boxShadow: '0 8px 24px rgba(79, 70, 229, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.4)' } : undefined}
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
