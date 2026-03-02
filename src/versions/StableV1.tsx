import React, { useState, useRef } from 'react';
import { Upload, FileAudio, Download, Loader2, CheckCircle2, AlertCircle, FileText, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { User } from 'firebase/auth';

interface Subtitle { start: string; end: string; text: string; }

export default function StableV1({ user, onOpenQuotaModal }: { user: User | null; onOpenQuotaModal: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [srtContent, setSrtContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setProgress('正在檢查額度...');

    try {
      const userDocRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(userDocRef);
      const currentQuota = docSnap.data()?.quota || 0;
      const durationMinutes = await getAudioDuration(file);
      
      if (currentQuota < durationMinutes) {
        onOpenQuotaModal(); // 觸發彈窗
        throw new Error(`額度不足。此音檔需 ${durationMinutes} 分鐘。`);
      }

      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve) => {
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
      });

      setProgress('正在辨識語音...');
      const workerUrl = "https://odd-sky-f30e.theoder.workers.dev";
      const payload = {
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ inlineData: { mimeType: file.type || 'audio/mpeg', data: base64Data } }, { text: "請精確轉錄這段音檔。輸出格式必須為 JSON 陣列，包含 'start' (HH:MM:SS,mmm), 'end' (HH:MM:SS,mmm), 和 'text' 欄位。每條字幕的 'text' 長度絕對不能超過 15 個字。請根據語氣自然斷句，且「絕對不要」包含任何標點符號。" }] }],
        config: { responseMimeType: "application/json" }
      };

      const workerResponse = await fetch(workerUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!workerResponse.ok) throw new Error("代理伺服器回應錯誤");
      const data = await workerResponse.json();
      const textResult = data.candidates[0].content.parts[0].text;
      let result: Subtitle[] = JSON.parse(textResult);

      await updateDoc(userDocRef, { quota: increment(-durationMinutes) });

      const srt = result.map((sub, index) => `${index + 1}\n${sub.start} --> ${sub.end}\n${sub.text}\n`).join('\n');
      setSrtContent(srt);
      setProgress('完成！');
    } catch (err: any) {
      setError(err.message || "發生錯誤。");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-2xl mx-auto space-y-12">
      <header className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold uppercase tracking-wider">
          <ShieldCheck size={14} />
          <span>VoxFlow V1 Stable</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">Vox<span className="text-indigo-600">Flow</span> V1</h1>
        <p className="text-slate-500 text-lg">基準穩定版：專注於極速、精準的單語轉錄。</p>
      </header>

      <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200/60 space-y-8">
        <div onClick={() => !isProcessing && fileInputRef.current?.click()} className={cn("relative group cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 p-12 flex flex-col items-center gap-4", file ? "border-indigo-600 bg-indigo-50/30" : "border-slate-200 hover:border-indigo-400 hover:bg-slate-50", isProcessing && "opacity-50 cursor-not-allowed")}>
          <input type="file" ref={fileInputRef} onChange={(e) => setFile(e.target.files?.[0] || null)} accept="audio/*" className="hidden" />
          {file ? <FileAudio size={48} className="text-indigo-600" /> : <Upload size={48} className="text-slate-400" />}
          <div className="text-center">
            <p className="font-bold text-slate-900 text-lg">{file ? file.name : "點擊上傳音檔"}</p>
            <p className="text-slate-400 text-sm mt-1">支援 MP3, WAV, M4A (最大 25MB)</p>
          </div>
        </div>

        {error && <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm flex items-center gap-2"><AlertCircle size={18} /> {error}</div>}

        <button onClick={processAudio} disabled={!file || isProcessing} className={cn("w-full py-4 rounded-2xl font-bold text-white transition-all flex items-center justify-center gap-2", !file || isProcessing ? "bg-slate-200 text-slate-400" : "bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100")}>
          {isProcessing ? <><Loader2 className="animate-spin" size={20} /> {progress}</> : <><FileText size={20} /> 開始生成字幕</>}
        </button>
      </section>

      {srtContent && (
        <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200/60 animate-in slide-in-from-bottom-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center"><CheckCircle2 size={24} /></div>
            <div><p className="font-bold text-slate-900 text-lg">字幕已就緒</p><p className="text-slate-400 text-sm">已自動從額度扣除分鐘數</p></div>
          </div>
          <button onClick={() => { const blob = new Blob([srtContent!], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${file?.name.split('.')[0]}.srt`; a.click(); }} className="px-8 py-4 bg-emerald-600 text-white font-bold rounded-2xl flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"><Download size={20} /> 下載 SRT</button>
        </section>
      )}
    </div>
  );
}