import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileAudio, Download, Loader2, CheckCircle2, AlertCircle, Trash2, Clock, Languages, History as HistoryIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { User } from 'firebase/auth';

interface SubtitleSegment { start: string; end: string; original: string; translated: string; }
interface HistoryItem { id: string; filename: string; date: string; originalSrt: string; translatedSrt: string; targetLang: string; }

const TARGET_LANGUAGES = [
  { label: '英文 (English)', value: 'English' },
  { label: '日文 (Japanese)', value: 'Japanese' },
  { label: '繁體中文 (Traditional Chinese)', value: 'Traditional Chinese' },
  { label: '韓文 (Korean)', value: 'Korean' },
  { label: '法文 (French)', value: 'French' },
  { label: '德文 (German)', value: 'German' },
];

export default function BilingualV3({ user }: { user: User | null }) {
  const [file, setFile] = useState<File | null>(null);
  const [targetLang, setTargetLang] = useState('English');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ original: string; translated: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedHistory = localStorage.getItem('voxflow_history_v3');
    if (savedHistory) try { setHistory(JSON.parse(savedHistory)); } catch (e) { console.error(e); }
  }, []);

  const saveToHistory = (filename: string, original: string, translated: string, lang: string) => {
    const newItem = { id: Date.now().toString(), filename, date: new Date().toLocaleString(), originalSrt: original, translatedSrt: translated, targetLang: lang };
    const updatedHistory = [newItem, ...history].slice(0, 10);
    setHistory(updatedHistory);
    localStorage.setItem('voxflow_history_v3', JSON.stringify(updatedHistory));
  };

  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.src = URL.createObjectURL(file);
      audio.onloadedmetadata = () => resolve(Math.ceil(audio.duration / 60));
    });
  };

  const processAudio = async () => {
    if (!file || !user) return;
    setIsProcessing(true);
    setError(null);
    setProgress('檢查額度...');
    try {
      const userDocRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(userDocRef);
      const currentQuota = docSnap.data()?.quota || 0;
      const durationMinutes = await getAudioDuration(file);
      
      if (currentQuota < durationMinutes) {
        throw new Error(`額度不足。需 ${durationMinutes} 分鐘，剩餘 ${currentQuota} 分鐘。`);
      }

      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
      });

      setProgress(`正在轉錄並翻譯至 ${targetLang}...`);
      const workerUrl = "https://odd-sky-f30e.theoder.workers.dev";
      const payload = { model: "gemini-3-flash-preview", contents: [{ role: "user", parts: [{ inlineData: { mimeType: file.type || 'audio/mpeg', data: base64Data } }, { text: `請精確轉錄這段音檔並翻譯成 ${targetLang}。輸出格式必須為 JSON 陣列，包含 'start' (HH:MM:SS,mmm), 'end' (HH:MM:SS,mmm), 'original' (原始語言), 和 'translated' (翻譯後的 ${targetLang}) 欄位。每條字幕的文字長度絕對不能超過 15 個字。請「絕對不要」在任何語言中包含標點符號。` }] }], config: { responseMimeType: "application/json" } };
      const workerResponse = await fetch(workerUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!workerResponse.ok) throw new Error("代理伺服器回應錯誤");
      const data = await workerResponse.json();
      const textResult = data.candidates[0].content.parts[0].text;
      let segments: SubtitleSegment[] = JSON.parse(textResult);

      await updateDoc(userDocRef, { quota: increment(-durationMinutes) });

      const originalSrt = segments.map((seg, index) => `${index + 1}\n${seg.start} --> ${seg.end}\n${seg.original}\n`).join('\n');
      const translatedSrt = segments.map((seg, index) => `${index + 1}\n${seg.start} --> ${seg.end}\n${seg.translated}\n`).join('\n');
      setResults({ original: originalSrt, translated: translatedSrt });
      saveToHistory(file.name, originalSrt, translatedSrt, targetLang);
      setProgress('完成並已扣除額度！');
    } catch (err: any) { setError(err.message || "發生錯誤。"); } finally { setIsProcessing(false); }
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  return (
    <div className="animate-in fade-in duration-500 space-y-12">
      <header className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold uppercase tracking-wider"><Languages size={14} /><span>VoxFlow V3 Bilingual</span></div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">Vox<span className="text-indigo-600">Flow</span> V3</h1>
        <p className="text-slate-500 text-lg max-w-md mx-auto">專業版：支援雙語分離轉錄，一鍵生成兩種語言的 SRT 檔案。</p>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200/60 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">1. 選擇目標語言</label><select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all">{TARGET_LANGUAGES.map(lang => (<option key={lang.value} value={lang.value}>{lang.label}</option>))}</select></div>
              <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">2. 上傳音檔</label><div onClick={() => !isProcessing && fileInputRef.current?.click()} className={cn("cursor-pointer rounded-xl border-2 border-dashed transition-all px-4 py-2 flex items-center gap-3", file ? "border-indigo-600 bg-indigo-50/30" : "border-slate-200 hover:border-indigo-400 hover:bg-slate-50", isProcessing && "opacity-50 cursor-not-allowed")}><input type="file" ref={fileInputRef} onChange={(e) => setFile(e.target.files?.[0] || null)} accept="audio/*" className="hidden" /><FileAudio size={20} className={file ? "text-indigo-600" : "text-slate-400"} /><p className="font-bold text-slate-900 text-sm truncate">{file ? file.name : "點擊上傳"}</p></div></div>
            </div>
            {error && <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm flex items-center gap-2"><AlertCircle size={18} /> {error}</div>}
            <button onClick={processAudio} disabled={!file || isProcessing} className={cn("w-full py-4 rounded-2xl font-bold text-white transition-all flex items-center justify-center gap-2", !file || isProcessing ? "bg-slate-200 text-slate-400" : "bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100")}>{isProcessing ? <><Loader2 className="animate-spin" size={20} /> {progress}</> : <><Languages size={20} /> 開始雙語轉錄</>}</button>
          </section>
          {results && (
            <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200/60 animate-in slide-in-from-bottom-4 space-y-6">
              <div className="flex items-center gap-4"><div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center"><CheckCircle2 size={20} /></div><div><p className="font-bold">雙語轉錄完成</p><p className="text-xs text-slate-400">已生成原始語言與 {targetLang} 翻譯</p></div></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={() => downloadFile(results.original, `${file?.name.split('.')[0]}_Original.srt`)} className="p-4 bg-slate-900 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"><Download size={18} /> 下載原始語言 SRT</button>
                <button onClick={() => downloadFile(results.translated, `${file?.name.split('.')[0]}_${targetLang}.srt`)} className="p-4 bg-indigo-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all"><Download size={18} /> 下載 {targetLang} SRT</button>
              </div>
            </section>
          )}
        </div>
        <div className="space-y-6">
          <div className="flex items-center gap-2 px-2"><HistoryIcon size={18} className="text-slate-400" /><h3 className="font-bold text-slate-900">雙語紀錄 (V3)</h3></div>
          <div className="space-y-3">
            {history.length === 0 ? (<div className="bg-slate-50 rounded-2xl p-8 text-center border border-slate-100"><p className="text-slate-400 text-sm font-medium">尚無雙語紀錄</p></div>) : (history.map((item) => (
              <div key={item.id} className="group bg-white rounded-2xl p-4 border border-slate-200/60 hover:border-indigo-200 transition-all shadow-sm"><div className="flex flex-col gap-2"><p className="font-bold text-slate-900 text-sm truncate pr-6">{item.filename}</p><div className="flex items-center justify-between"><p className="text-[10px] text-slate-400 font-medium">{item.date}</p><span className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">{item.targetLang}</span></div><div className="grid grid-cols-2 gap-2 mt-2"><button onClick={() => downloadFile(item.originalSrt, `${item.filename.split('.')[0]}_Original.srt`)} className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-1"><Download size={12} /> 原文</button><button onClick={() => downloadFile(item.translatedSrt, `${item.filename.split('.')[0]}_${item.targetLang}.srt`)} className="py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-1"><Download size={12} /> 譯文</button></div><button onClick={() => { const updated = history.filter(h => h.id !== item.id); localStorage.setItem('voxflow_history_v3', JSON.stringify(updated)); }} className="mt-1 self-end text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={12} /></button></div></div>
            )))}
          </div>
        </div>
      </div>
    </div>
  );
}