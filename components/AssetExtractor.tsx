import React, { useState } from 'react';
import { Search, Download, Loader2, AlertCircle, Image as ImageIcon, Smartphone, Package, CheckCircle, XCircle, Clock } from 'lucide-react';
import { scrapeStoreUrl, fetchBlobViaProxy } from '../services/scraperService';
import { ICON_SPECS, SCREENSHOT_SPECS, ResizeSpec } from '../types';
import JSZip from 'jszip';

interface AssetExtractorProps {
  onAssetsReady?: () => void;
}

interface ResizedImage {
  spec: ResizeSpec;
  url: string; // Base64 PNG
}

interface AssetGroup {
  originalUrl: string;
  type: 'ICON' | 'SCREENSHOT';
  resized: ResizedImage[];
}

interface ExtractionJob {
  id: string;
  url: string;
  status: 'PENDING' | 'SCRAPING' | 'PROCESSING' | 'SUCCESS' | 'ERROR';
  statusMessage?: string;
  error?: string;
  appName: string;
  assets: AssetGroup[];
  isZipping?: boolean;
}

export const AssetExtractor: React.FC<AssetExtractorProps> = () => {
  const [urlsText, setUrlsText] = useState('');
  const [isGlobalProcessing, setIsGlobalProcessing] = useState(false);
  const [jobs, setJobs] = useState<ExtractionJob[]>([]);

  // Helper to update a specific job in the state array
  const updateJob = (id: string, updates: Partial<ExtractionJob>) => {
    setJobs(prev => prev.map(job => job.id === id ? { ...job, ...updates } : job));
  };

  const processImageBlob = async (blob: Blob, specs: ResizeSpec[], type: 'ICON' | 'SCREENSHOT'): Promise<ResizedImage[]> => {
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(blob);
      
      img.onload = () => {
        const resizedList: ResizedImage[] = [];
        
        // --- RELAXED QUALITY CHECK ---
        if (type === 'ICON' && (img.width < 50 || img.height < 50)) {
           URL.revokeObjectURL(objectUrl);
           resolve([]); 
           return;
        }
        if (type === 'SCREENSHOT' && (img.width < 200 || img.height < 200)) {
           console.warn("Discarding too small screenshot:", img.width, img.height);
           URL.revokeObjectURL(objectUrl);
           resolve([]); 
           return;
        }

        specs.forEach(spec => {
          const canvas = document.createElement('canvas');
          canvas.width = spec.width;
          canvas.height = spec.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            if (type === 'ICON') {
                // Clear and Center Fit
                ctx.clearRect(0, 0, spec.width, spec.height);
                const scale = Math.min(spec.width / img.width, spec.height / img.height);
                const w = img.width * scale;
                const h = img.height * scale;
                const x = (spec.width - w) / 2;
                const y = (spec.height - h) / 2;
                ctx.drawImage(img, x, y, w, h);
            } else {
                // SCREENSHOT
                // High-End Blur Background
                ctx.fillStyle = '#0f172a'; 
                ctx.fillRect(0, 0, spec.width, spec.height);

                // 1. Draw Blurred Background (Fill Cover)
                const scaleCover = Math.max(spec.width / img.width, spec.height / img.height);
                const wCover = img.width * scaleCover;
                const hCover = img.height * scaleCover;
                const xCover = (spec.width - wCover) / 2;
                const yCover = (spec.height - hCover) / 2;
                
                ctx.save();
                ctx.filter = 'blur(40px) brightness(0.5)';
                ctx.drawImage(img, xCover - 20, yCover - 20, wCover + 40, hCover + 40);
                ctx.restore();

                // 2. Draw Main Image (Contain)
                const scaleContain = Math.min(spec.width / img.width, spec.height / img.height);
                const wContain = img.width * scaleContain;
                const hContain = img.height * scaleContain;
                const xContain = (spec.width - wContain) / 2;
                const yContain = (spec.height - hContain) / 2;
                
                // Drop shadow
                ctx.shadowColor = "rgba(0,0,0,0.5)";
                ctx.shadowBlur = 30;
                ctx.shadowOffsetY = 10;

                ctx.drawImage(img, xContain, yContain, wContain, hContain);
            }

            try {
              resizedList.push({
                spec,
                url: canvas.toDataURL('image/png')
              });
            } catch (e) {
              console.error("Canvas draw error", e);
            }
          }
        });
        
        URL.revokeObjectURL(objectUrl);
        resolve(resizedList);
      };

      img.onerror = () => {
        console.error("Failed to load image blob");
        URL.revokeObjectURL(objectUrl);
        resolve([]);
      };

      img.src = objectUrl;
    });
  };

  const processJob = async (job: ExtractionJob) => {
    try {
      updateJob(job.id, { status: 'SCRAPING', statusMessage: 'Fetching page...' });

      const data = await scrapeStoreUrl(job.url);
      
      if (!data.iconUrl && data.screenshotUrls.length === 0) {
        throw new Error("No assets found. Ensure the URL is correct.");
      }

      const foundAppName = data.appName || 'app_assets';
      updateJob(job.id, { appName: foundAppName, status: 'PROCESSING', statusMessage: 'Processing images...' });

      const newAssets: AssetGroup[] = [];
      let screenshotCount = 0;

      // Process Icon
      if (data.iconUrl) {
        try {
          const blob = await fetchBlobViaProxy(data.iconUrl);
          const resized = await processImageBlob(blob, ICON_SPECS, 'ICON');
          if (resized.length > 0) {
            newAssets.push({
              originalUrl: data.iconUrl,
              type: 'ICON',
              resized
            });
          }
        } catch (e) {
          console.error("Failed to process icon", e);
        }
      }

      // Process Screenshots
      for (let i = 0; i < data.screenshotUrls.length; i++) {
        updateJob(job.id, { statusMessage: `Processing screenshot ${i + 1}/${data.screenshotUrls.length}...` });
        try {
          const sUrl = data.screenshotUrls[i];
          const blob = await fetchBlobViaProxy(sUrl);
          const resized = await processImageBlob(blob, SCREENSHOT_SPECS, 'SCREENSHOT');
          if (resized.length > 0) {
            newAssets.push({
              originalUrl: sUrl,
              type: 'SCREENSHOT',
              resized
            });
            screenshotCount++;
          }
        } catch (e) {
          console.warn(`Skipping screenshot ${i}:`, e);
        }
      }

      if (newAssets.length === 0) {
         throw new Error("Found image URLs but failed to load them. The website might be blocking us.");
      }
      
      let finalStatusMessage = '';
      if (screenshotCount === 0 && data.screenshotUrls.length > 0) {
        finalStatusMessage = "Screenshots were too small or blocked.";
      }

      updateJob(job.id, { 
        status: 'SUCCESS', 
        assets: newAssets, 
        appName: foundAppName,
        error: finalStatusMessage ? finalStatusMessage : undefined 
      });

    } catch (err: any) {
      updateJob(job.id, { status: 'ERROR', error: err.message || "Extraction failed" });
    }
  };

  const handleExtract = async () => {
    const urls = urlsText.split('\n').map(u => u.trim()).filter(u => u);
    if (urls.length === 0) return;

    setIsGlobalProcessing(true);

    // Initialize Jobs
    const newJobs: ExtractionJob[] = urls.map(url => ({
      id: crypto.randomUUID(),
      url,
      status: 'PENDING',
      appName: 'Pending...',
      assets: []
    }));

    setJobs(newJobs);

    // Process Sequentially to avoid overwhelming browser/proxies
    for (const job of newJobs) {
      await processJob(job);
    }

    setIsGlobalProcessing(false);
  };

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadZip = async (job: ExtractionJob) => {
      if (job.assets.length === 0) return;
      updateJob(job.id, { isZipping: true });

      try {
          const zip = new JSZip();
          const safeName = (job.appName || 'assets').replace(/[^a-z0-9\s-_]/gi, '').trim().replace(/\s+/g, '_');
          const folder = zip.folder(safeName);

          if (!folder) throw new Error("Failed to create zip folder");

          job.assets.forEach((group, gIdx) => {
              group.resized.forEach((img) => {
                  const prefix = group.type === 'ICON' ? 'icon' : `screenshot-${gIdx + 1}`;
                  const filename = `${prefix}-${img.spec.width}x${img.spec.height}.png`;
                  const base64Data = img.url.split(',')[1];
                  folder.file(filename, base64Data, {base64: true});
              });
          });

          const content = await zip.generateAsync({type: "blob"});
          const zipUrl = URL.createObjectURL(content);

          const link = document.createElement('a');
          link.href = zipUrl;
          link.download = `${safeName}.zip`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(zipUrl);

      } catch (e) {
          console.error("Zip generation error:", e);
      } finally {
          updateJob(job.id, { isZipping: false });
      }
  };

  return (
    <div className="space-y-8">
      {/* Search Input Section */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Search className="text-blue-400" />
          Batch Extraction
        </h2>
        <div className="flex flex-col gap-4">
          <textarea 
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
            placeholder={"Paste Store URLs (APKCombo, APKPure, Play Store)\nOne URL per line..."}
            className="w-full h-32 bg-slate-900 border border-slate-700 text-white rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none font-mono text-sm"
          />
          <button 
            onClick={handleExtract}
            disabled={isGlobalProcessing || !urlsText.trim()}
            className={`w-full py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition
              ${isGlobalProcessing || !urlsText.trim()
                ? 'bg-slate-700 cursor-not-allowed text-slate-500' 
                : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20'
              }`}
          >
            {isGlobalProcessing ? <Loader2 className="animate-spin" /> : 'Extract All'}
          </button>
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-8">
        {jobs.map((job) => (
          <div key={job.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
            {/* Job Header */}
            <div className="p-4 bg-slate-900/50 border-b border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div className="flex items-center gap-3 overflow-hidden">
                  {job.status === 'PENDING' && <Clock className="text-slate-500 flex-shrink-0" />}
                  {job.status === 'SCRAPING' && <Loader2 className="animate-spin text-blue-400 flex-shrink-0" />}
                  {job.status === 'PROCESSING' && <Loader2 className="animate-spin text-purple-400 flex-shrink-0" />}
                  {job.status === 'SUCCESS' && <CheckCircle className="text-green-500 flex-shrink-0" />}
                  {job.status === 'ERROR' && <XCircle className="text-red-500 flex-shrink-0" />}
                  
                  <div className="min-w-0">
                    <h3 className="text-white font-bold text-lg truncate">{job.appName}</h3>
                    <p className="text-slate-400 text-xs truncate font-mono">{job.url}</p>
                    {job.statusMessage && <p className="text-blue-400 text-xs mt-1 animate-pulse">{job.statusMessage}</p>}
                    {job.error && <p className="text-red-400 text-xs mt-1">{job.error}</p>}
                  </div>
               </div>

               {job.status === 'SUCCESS' && (
                  <button 
                    onClick={() => downloadZip(job)}
                    disabled={job.isZipping}
                    className="flex-shrink-0 bg-green-600 hover:bg-green-500 text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow transition disabled:bg-slate-700"
                  >
                     {job.isZipping ? <Loader2 className="animate-spin w-4 h-4" /> : <Package size={16} />}
                     Download ZIP
                  </button>
               )}
            </div>

            {/* Job Body (Assets) */}
            {job.status === 'SUCCESS' && (
               <div className="p-6 space-y-8">
                  
                  {/* Icons */}
                  {job.assets.some(r => r.type === 'ICON') && (
                     <div className="space-y-3">
                       <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                         <ImageIcon size={14} /> Icon Assets
                       </h4>
                       <div className="flex flex-wrap gap-4">
                         {job.assets.filter(r => r.type === 'ICON').map((group, idx) => (
                            group.resized.map((img, rIdx) => (
                              <div key={`icon-${idx}-${rIdx}`} className="bg-slate-900 p-3 rounded-lg border border-slate-700/50 flex flex-col items-center gap-2 w-36">
                                 <div className="w-20 h-20 bg-slate-800 rounded flex items-center justify-center p-1 relative bg-[url('https://placehold.co/4x4/1e293b/334155.png')]">
                                   <img src={img.url} className="max-w-full max-h-full object-contain" alt="icon" />
                                 </div>
                                 <div className="text-center w-full">
                                    <p className="text-slate-300 text-[10px] font-mono mb-1">{img.spec.width}x{img.spec.height}</p>
                                    <button 
                                      onClick={() => downloadImage(img.url, `icon-${img.spec.width}.png`)}
                                      className="w-full py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition"
                                    >
                                      Download
                                    </button>
                                 </div>
                              </div>
                            ))
                         ))}
                       </div>
                     </div>
                  )}

                  {/* Screenshots */}
                  {job.assets.some(r => r.type === 'SCREENSHOT') && (
                     <div className="space-y-3">
                       <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                         <Smartphone size={14} /> Screenshots ({job.assets.filter(r => r.type === 'SCREENSHOT').length})
                       </h4>
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {job.assets.filter(r => r.type === 'SCREENSHOT').map((group, idx) => (
                            <div key={`shot-${idx}`} className="bg-slate-900 p-4 rounded-lg border border-slate-700/50">
                               <p className="text-slate-500 text-[10px] uppercase font-bold mb-3">Shot #{idx + 1}</p>
                               <div className="space-y-3">
                                  {group.resized.map((img, rIdx) => (
                                     <div key={rIdx} className="flex items-center justify-between gap-3 bg-slate-800/50 p-2 rounded">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-12 bg-slate-900 border border-slate-700 rounded overflow-hidden">
                                                <img src={img.url} className="w-full h-full object-contain" alt="prev" />
                                            </div>
                                            <span className="text-slate-300 text-xs font-mono">{img.spec.width}x{img.spec.height}</span>
                                        </div>
                                        <button 
                                          onClick={() => downloadImage(img.url, `shot-${idx+1}-${img.spec.width}.png`)}
                                          className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-white rounded transition"
                                        >
                                           <Download size={14} />
                                        </button>
                                     </div>
                                  ))}
                               </div>
                            </div>
                          ))}
                       </div>
                     </div>
                  )}
               </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
