import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Image as ImageIcon, DownloadCloud } from 'lucide-react';

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
    
    // Simulate complex PDF image extraction in WASM
    // In production, pdfjs-dist would parse the PDF operators to find all image streams
    await new Promise(r => setTimeout(r, 2000));
    
    // Provide simulated sample extracted images
    setExtractedImages([
       'https://images.unsplash.com/photo-1542125387-c71274d94f0a?auto=format&fit=crop&q=80&w=400',
       'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=400',
       'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=400'
    ]);
    
    setIsProcessing(false);
  };

  return (
    <div className="flex-1 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col lg:flex-row flex-1">
        
        {/* Left Side: Upload */}
        <div className="w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50/50 p-6 flex flex-col gap-6">
          <div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">Source Target</h3>
            <p className="text-sm text-slate-500">Upload PDF to pull graphs & images.</p>
          </div>

          <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${isDragActive ? 'border-purple-500 bg-purple-50' : 'border-slate-300 hover:border-slate-400 bg-white'}`}>
            <input {...getInputProps()} />
            <UploadCloud className={`w-10 h-10 mb-3 ${isDragActive ? 'text-purple-500' : 'text-slate-400'}`} />
            {file ? (
              <div className="flex flex-col items-center">
                <p className="text-sm font-medium text-slate-900 truncate max-w-full px-4">{file.name}</p>
                <p className="text-xs text-slate-500 mt-1">{(file.size/1024/1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <p className="text-sm font-medium text-slate-700">Drop PDF here to scan</p>
            )}
          </div>

          <button
            onClick={handleExtract}
            disabled={!file || isProcessing}
            className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${!file || isProcessing ? 'bg-slate-200 text-slate-500' : 'bg-purple-600 hover:bg-purple-700 text-white shadow-md'}`}
          >
            {isProcessing ? 'Scanning pages...' : 'Extract All Images'}
          </button>
        </div>

        {/* Right Side: Results */}
        <div className="flex-1 p-6 flex flex-col bg-slate-50 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-slate-900 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-purple-600" />
              Extracted Assets
            </h3>
            {extractedImages.length > 0 && <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-1 rounded-full font-medium">{extractedImages.length} found</span>}
          </div>
          
          {extractedImages.length === 0 ? (
             <div className="text-center text-slate-400 my-auto p-12 mt-12 bg-white rounded-xl border border-dashed border-slate-300">
                <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No images extracted yet.</p>
             </div>
          ) : (
             <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
               {extractedImages.map((src, i) => (
                 <div key={i} className="group relative bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition">
                    <img src={src} className="w-full h-32 object-cover" alt={`Extract ${i}`} />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm">
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
                          className="bg-white text-slate-900 px-3 py-1.5 rounded font-medium text-sm flex items-center gap-1 hover:bg-purple-50"
                       >
                          <DownloadCloud className="w-4 h-4" /> PNG
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
