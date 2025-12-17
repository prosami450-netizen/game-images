import React, { useState } from 'react';
import { Wand2, Loader2, AlertCircle } from 'lucide-react';
import { ImageSize } from '../types';
import { generateAppAsset } from '../services/geminiService';

interface AssetGeneratorProps {
  onImageGenerated: (imageUrl: string) => void;
}

export const AssetGenerator: React.FC<AssetGeneratorProps> = ({ onImageGenerated }) => {
  const [prompt, setPrompt] = useState('');
  const [assetType, setAssetType] = useState<'ICON' | 'SCREENSHOT'>('ICON');
  const [size, setSize] = useState<ImageSize>(ImageSize.SIZE_1K);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const aspectRatio = assetType === 'ICON' ? '1:1' : '16:9';
      // Append some context to the prompt to ensure better app asset results
      const fullPrompt = assetType === 'ICON' 
        ? `App icon, high quality, vector style, minimal, ${prompt}`
        : `Mobile app screenshot, high resolution, UI/UX design, ${prompt}`;

      const imageUrl = await generateAppAsset(fullPrompt, size, aspectRatio);
      onImageGenerated(imageUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to generate image');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Wand2 className="text-purple-400" />
          Generate New Assets
        </h2>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
           <div>
             <label className="block text-slate-400 text-sm font-medium mb-2">Asset Type</label>
             <div className="flex gap-2 bg-slate-900 p-1 rounded-lg">
                <button 
                  onClick={() => setAssetType('ICON')}
                  className={`flex-1 py-2 text-sm font-medium rounded transition ${assetType === 'ICON' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Icon (1:1)
                </button>
                <button 
                  onClick={() => setAssetType('SCREENSHOT')}
                  className={`flex-1 py-2 text-sm font-medium rounded transition ${assetType === 'SCREENSHOT' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Screenshot (16:9)
                </button>
             </div>
           </div>

           <div>
             <label className="block text-slate-400 text-sm font-medium mb-2">Quality</label>
             <select 
               value={size}
               onChange={(e) => setSize(e.target.value as ImageSize)}
               className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none"
             >
               <option value={ImageSize.SIZE_1K}>1K (Standard)</option>
               <option value={ImageSize.SIZE_2K}>2K (High Res)</option>
               <option value={ImageSize.SIZE_4K}>4K (Ultra Res)</option>
             </select>
           </div>
        </div>

        <div className="mb-4">
          <label className="block text-slate-400 text-sm font-medium mb-2">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={assetType === 'ICON' ? "e.g., A minimalist rocket ship logo, blue gradient..." : "e.g., A fitness tracker dashboard showing daily steps and heart rate..."}
            className="w-full h-28 bg-slate-900 border border-slate-700 text-white rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700/50 rounded text-red-200 text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className={`w-full py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition
            ${loading || !prompt.trim() 
              ? 'bg-slate-700 cursor-not-allowed text-slate-500' 
              : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-900/20'
            }`}
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" /> Generating...
            </>
          ) : (
            <>
              Generate with Gemini 3 Pro
            </>
          )}
        </button>
        <p className="text-center text-xs text-slate-500 mt-2">
           Uses <strong>gemini-3-pro-image-preview</strong> model.
        </p>
      </div>
    </div>
  );
};
