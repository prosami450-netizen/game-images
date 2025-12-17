import React, { useState, useRef, useEffect } from 'react';
import { Download, Upload, Image as ImageIcon, Smartphone } from 'lucide-react';
import { ICON_SPECS, SCREENSHOT_SPECS, ResizeSpec } from '../types';

interface AssetFormatterProps {
  initialImage?: string; // Optional image passed from generator/editor
}

export const AssetFormatter: React.FC<AssetFormatterProps> = ({ initialImage }) => {
  const [sourceImage, setSourceImage] = useState<string | null>(initialImage || null);
  const [processedImages, setProcessedImages] = useState<{ spec: ResizeSpec; url: string }[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (initialImage) {
      setSourceImage(initialImage);
      processImage(initialImage);
    }
  }, [initialImage]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setSourceImage(result);
        processImage(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = (imgSrc: string) => {
    const img = new Image();
    img.src = imgSrc;
    img.onload = () => {
      const allSpecs = [...ICON_SPECS, ...SCREENSHOT_SPECS];
      const results: { spec: ResizeSpec; url: string }[] = [];

      allSpecs.forEach((spec) => {
        const canvas = document.createElement('canvas');
        canvas.width = spec.width;
        canvas.height = spec.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Fill background for transparency safety
          ctx.fillStyle = 'transparent';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Draw image - using "Cover" logic generally looks better for screenshots/icons
          // but "Contain" is safer for preserving full content. 
          // Let's implement a smart fit: "Contain" centered.
          const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
          const x = (canvas.width / 2) - (img.width / 2) * scale;
          const y = (canvas.height / 2) - (img.height / 2) * scale;
          
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
          
          results.push({
            spec,
            url: canvas.toDataURL('image/png')
          });
        }
      });
      setProcessedImages(results);
    };
  };

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = () => {
    processedImages.forEach((item, index) => {
       setTimeout(() => {
           handleDownload(item.url, `asset-${item.spec.width}x${item.spec.height}.png`);
       }, index * 200);
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-slate-800 rounded-xl border border-slate-700 shadow-xl">
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Input Section */}
        <div className="flex-1 space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Upload size={24} className="text-blue-400" />
            Source Asset
          </h2>
          
          <div className="relative group">
            <div className={`
              border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center
              transition-colors duration-200 h-64
              ${sourceImage ? 'border-slate-600 bg-slate-900' : 'border-blue-500 bg-slate-800 hover:bg-slate-750'}
            `}>
              {sourceImage ? (
                <img 
                  src={sourceImage} 
                  alt="Source" 
                  className="max-h-full max-w-full object-contain rounded shadow-lg" 
                />
              ) : (
                <div className="space-y-3">
                  <Upload className="w-12 h-12 text-slate-400 mx-auto" />
                  <p className="text-slate-300 font-medium">Click to upload or drag image</p>
                  <p className="text-slate-500 text-sm">Supports PNG, JPG, WebP</p>
                </div>
              )}
              <input 
                type="file" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept="image/*"
                onChange={handleFileUpload}
              />
            </div>
            {sourceImage && (
              <div className="absolute top-2 right-2">
                 <button 
                  onClick={() => setSourceImage(null)}
                  className="bg-slate-900/80 text-white p-2 rounded-full hover:bg-red-500 transition"
                 >
                   Clear
                 </button>
              </div>
            )}
          </div>
        </div>

        {/* Output Section */}
        <div className="flex-1 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Download size={24} className="text-green-400" />
              Formatted Assets
            </h2>
            {processedImages.length > 0 && (
               <button 
                onClick={handleDownloadAll}
                className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded font-semibold transition"
               >
                 Download All
               </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 max-h-[600px] overflow-y-auto pr-2">
             {processedImages.length === 0 && (
                 <div className="text-slate-500 text-center py-10 italic">
                     Upload an image to generate formatted assets.
                 </div>
             )}

             {/* Icons */}
             {processedImages.filter(p => p.spec.width <= 512).length > 0 && (
                 <div className="space-y-3">
                     <h3 className="text-slate-400 text-sm uppercase tracking-wider font-semibold flex items-center gap-2">
                         <ImageIcon size={16} /> Icons
                     </h3>
                     {processedImages.filter(p => p.spec.width <= 512).map((item, idx) => (
                         <div key={idx} className="bg-slate-700 p-3 rounded-lg flex items-center justify-between group">
                             <div className="flex items-center gap-4">
                                 <div className="w-12 h-12 bg-slate-900 rounded overflow-hidden border border-slate-600">
                                     <img src={item.url} className="w-full h-full object-contain" alt="preview" />
                                 </div>
                                 <div>
                                     <p className="text-slate-200 font-medium text-sm">{item.spec.label}</p>
                                     <p className="text-slate-500 text-xs">PNG • {item.spec.width}x{item.spec.height}</p>
                                 </div>
                             </div>
                             <button 
                               onClick={() => handleDownload(item.url, `icon-${item.spec.width}.png`)}
                               className="bg-slate-600 hover:bg-blue-600 text-white p-2 rounded-lg transition"
                               title="Download"
                             >
                                 <Download size={16} />
                             </button>
                         </div>
                     ))}
                 </div>
             )}

             {/* Screenshots */}
             {processedImages.filter(p => p.spec.width > 512 || p.spec.height > 512).length > 0 && (
                 <div className="space-y-3 mt-4">
                     <h3 className="text-slate-400 text-sm uppercase tracking-wider font-semibold flex items-center gap-2">
                         <Smartphone size={16} /> Screenshots
                     </h3>
                     {processedImages.filter(p => p.spec.width > 512 || p.spec.height > 512).map((item, idx) => (
                         <div key={idx} className="bg-slate-700 p-3 rounded-lg flex items-center justify-between group">
                             <div className="flex items-center gap-4">
                                 <div className={`bg-slate-900 rounded overflow-hidden border border-slate-600 ${item.spec.height > item.spec.width ? 'w-8 h-12' : 'w-12 h-8'}`}>
                                     <img src={item.url} className="w-full h-full object-contain" alt="preview" />
                                 </div>
                                 <div>
                                     <p className="text-slate-200 font-medium text-sm">{item.spec.label}</p>
                                     <p className="text-slate-500 text-xs">PNG • {item.spec.width}x{item.spec.height}</p>
                                 </div>
                             </div>
                             <button 
                               onClick={() => handleDownload(item.url, `screenshot-${item.spec.width}x${item.spec.height}.png`)}
                               className="bg-slate-600 hover:bg-blue-600 text-white p-2 rounded-lg transition"
                               title="Download"
                             >
                                 <Download size={16} />
                             </button>
                         </div>
                     ))}
                 </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};
