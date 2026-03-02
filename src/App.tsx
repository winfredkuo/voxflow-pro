import React, { useState } from 'react';
import StableV1 from './versions/StableV1';
import HistoryV2 from './versions/HistoryV2';
import BilingualV3 from './versions/BilingualV3';
import { Layers, History as HistoryIcon, Languages, Edit3, ShieldCheck } from 'lucide-react';
import { cn } from './lib/utils';

type Version = 'v1' | 'v2' | 'v3';

export default function App() {
  const [activeVersion, setActiveVersion] = useState<Version>('v3');

  const versions = [
    { id: 'v1', name: 'V1 Stable', icon: ShieldCheck, desc: '基準穩定版' },
    { id: 'v2', name: 'V2 History', icon: HistoryIcon, desc: '本地紀錄版' },
    { id: 'v3', name: 'V3 Bilingual', icon: Languages, desc: '雙語翻譯版' },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FC] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-700">
      {/* Version Switcher Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <Layers size={18} />
            </div>
            <span className="font-black text-xl tracking-tight">VoxFlow <span className="text-indigo-600">Lab</span></span>
          </div>

          <div className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {versions.map((v) => (
              <button
                key={v.id}
                onClick={() => setActiveVersion(v.id as Version)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
                  activeVersion === v.id 
                    ? "bg-white text-indigo-600 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                <v.icon size={16} />
                <span>{v.name}</span>
              </button>
            ))}
          </div>

          <div className="md:hidden">
            <select 
              value={activeVersion}
              onChange={(e) => setActiveVersion(e.target.value as Version)}
              className="bg-slate-100 border-none rounded-lg px-3 py-2 text-sm font-bold text-indigo-600 outline-none"
            >
              {versions.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {activeVersion === 'v1' && <StableV1 />}
        {activeVersion === 'v2' && <HistoryV2 />}
        {activeVersion === 'v3' && <BilingualV3 />}
      </div>

      <footer className="pb-12 text-center text-slate-400 text-sm">
        <p>© 2024 VoxFlow AI Lab • Professional Transcription Ecosystem</p>
      </footer>
    </div>
  );
}
