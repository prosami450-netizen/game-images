import React, { useState } from 'react';
import { Edit3, Loader2, AlertCircle } from 'lucide-react';
import { editAppAsset } from '../services/geminiService';

interface AssetEditorProps {
  initialImage?: string;
  onImageEdited: (imageUrl: string) => void;
}

export const AssetEditor: React.FC<AssetEditorProps> = ({ initialImage, onImageEdited }) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEdit = async () => {
    if (!prompt.trim() || !initialImage) return;

    setLoading(true);
    setError(null);

    try {
      const imageUrl = await editAppAsset(initialImage, prompt);
      onImageEdited(imageUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to edit image');
    } finally {
      setLoading(false);
    }
  };

  if (!initialImage) {
      return (
          <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 text-center">
              <div className="inline-block p-4 bg-slate-900 rounded-full mb-4">
                  <Edit3 className="text-slate-500 w-8 h-8" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No Image Selected</h3>
              <p className="text-slate-400">Generate or Upload an image first to use the AI Editor.</p>
          </div>
      );
  }

  return (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Edit3 className="text-orange-400" />
        Edit Asset
      </h2>

      <div className="mb-6 flex justify-center bg-slate-900 p-4 rounded-lg border border-slate-700">
          <img src={initialImage} alt="To Edit" className="max-h-64 object-contain rounded" />
      </div>

      <div className="mb-4">
        <label className="block text-slate-400 text-sm font-medium mb-2">Editing Instruction</label>
        <div className="flex gap-2">
           <input
             type="text"
             value={prompt}
             onChange={(e) => setPrompt(e.target.value)}
             placeholder="e.g., Add a retro filter, Remove the background person..."
             className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-lg p-3 focus:ring-2 focus:ring-orange-500 focus:outline-none"
             onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
           />
           <button
             onClick={handleEdit}
             disabled={loading || !prompt.trim()}
             className={`px-6 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition
               ${loading || !prompt.trim() 
                 ? 'bg-slate-700 cursor-not-allowed text-slate-500' 
                 : 'bg-orange-600 hover:bg-orange-500 shadow-lg'
               }`}
           >
             {loading ? <Loader2 className="animate-spin" /> : 'Apply'}
           </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700/50 rounded text-red-200 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}
      
       <p className="text-center text-xs text-slate-500 mt-2">
           Uses <strong>gemini-2.5-flash-image</strong> model.
       </p>
    </div>
  );
};
