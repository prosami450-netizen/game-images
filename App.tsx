import React, { useState } from 'react';
import { AssetFormatter } from './components/AssetFormatter';
import { AssetExtractor } from './components/AssetExtractor';
import { Layout, Search, Image as ImageIcon } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'EXTRACT' | 'FORMAT'>('EXTRACT');

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 font-sans">
      
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
               <Layout className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-400">
              App Asset Studio
            </h1>
          </div>
          
          <div className="flex gap-1 bg-slate-800 p-1 rounded-lg">
             <button
               onClick={() => setActiveTab('EXTRACT')}
               className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'EXTRACT' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
             >
               <Search size={16} /> Extract
             </button>
             <button
               onClick={() => setActiveTab('FORMAT')}
               className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'FORMAT' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
             >
               <ImageIcon size={16} /> Manual Format
             </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        
        <div className="grid grid-cols-1 gap-8">
           {activeTab === 'EXTRACT' && (
             <AssetExtractor />
           )}
           
           {activeTab === 'FORMAT' && (
             <div className="space-y-4">
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50 text-slate-300 text-sm">
                   Upload your own images here to resize them to standard App Store formats (114x114, 512x512, 1280x720, etc).
                </div>
                <AssetFormatter />
             </div>
           )}
        </div>
      </main>
    </div>
  );
};

export default App;
