import React, { useState, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Upload, FileAudio, Download, Loader2, CheckCircle2, AlertCircle, Languages, FileText } from 'lucide-react';
import { cn } from '../lib/utils';

interface Subtitle {
  start: string;
  end: string;
  text: string;
}

export default function StableV1() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [srtContent, setSrtContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 25 * 1024 * 1024) {
        setError("檔案太大。為了確保處理穩定，請上傳 25MB 以下的音檔。");
        return;
      }
      setFile(selectedFile);
      setError(null);
      setSrtContent(null);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const timeToMs = (timeStr: string): number => {
    const [time, ms] = timeStr.split(',');
    const [h, m, s] = time.split(':').map(Number);
    return h * 3600000 + m * 60000 + s * 1000 + Number(ms);
  };

  const convertToSrt = (subtitles: Subtitle[]): string => {
    return subtitles.map((sub, index) => {
      return `${index + 1}\n${sub.start} --> ${sub.end}\n${sub.text}\n`;
    }).join('\n');
  };

  const processAudio = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setProgress('正在讀取音檔...');

    try {
      const base64Data = await fileToBase64(file);
      setProgress('正在辨識語音並生成字幕...');

      // 改用 Cloudflare Worker 代理
      const workerUrl = "https://odd-sky-f30e.theoder.workers.dev";
      
      const payload = {
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: file.type || 'audio/mpeg', data: base64Data } },
              { text: "請精確轉錄這段音檔。輸出格式必須為 JSON 陣列，包含 'start' (HH:MM:SS,mmm), 'end' (HH:MM:SS,mmm), 和 'text' 欄位。每條字幕的 'text' 長度絕對不能超過 15 個字。請根據語氣自然斷句，且「絕對不要」包含任何標點符號（如逗號、句號、問號等）。" }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                start: { type: Type.STRING },
                end: { type: Type.STRING },
                text: { type: Type.STRING }
              },
              required: ["start", "end", "text"]
            }
          }
        }
      };

      const workerResponse = await fetch(workerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!workerResponse.ok) throw new Error("代理伺服器回應錯誤");
      const data = await workerResponse.json();
      const textResult = data.candidates[0].content.parts[0].text;
      let result: Subtitle[] = JSON.parse(textResult);

      setProgress('正在優化字幕間隙...');

      for (let i = 0; i < result.length - 1; i++) {
        const currentEndMs = timeToMs(result[i].end);
        const nextStartMs = timeToMs(result[i + 1].start);
        const gap = nextStartMs - currentEndMs;
        if (gap > 0 && gap <= 2000) {
          result[i].end = result[i + 1].start;
        }
      }

      const srt = convertToSrt(result);
      setSrtContent(srt);
      setProgress('完成！');
    } catch (err: any) {
      console.error("處理錯誤:", err);
      setError(err.message || "轉錄過程中發生錯誤，請稍後再試。");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadSrt = () => {
    if (!srtContent) return;
    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file?.name.split('.')[0] || 'subtitles'}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-in fade-in duration-500">
      <header className="text-center space-y-4 mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold uppercase tracking-wider">
          <CheckCircle2 size={14} />
          <span>VoxFlow V1 Stable</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">
          Vox<span className="text-indigo-600">Flow</span> V1
        </h1>
        <p className="text-slate-500 text-lg max-w-md mx-auto">
          基準穩定版：15 字斷句、2 秒間隙補齊。
        </p>
      </header>

      <main className="space-y-8">
        <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200/60">
          <div className="max-w-lg mx-auto text-center space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-900">上傳音檔</h2>
              <p className="text-slate-500">MP3, WAV, AAC • 建議 25MB 以下</p>
            </div>

            <div 
              onClick={() => !isProcessing && fileInputRef.current?.click()}
              className={cn(
                "relative group cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 p-12",
                file 
                  ? "border-indigo-600 bg-indigo-50/30" 
                  : "border-slate-200 hover:border-indigo-400 hover:bg-slate-50",
                isProcessing && "opacity-50 cursor-not-allowed"
              )}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="audio/*"
                className="hidden"
              />
              
              <div className="flex flex-col items-center gap-4">
                {file ? (
                  <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200 animate-in zoom-in duration-300">
                    <FileAudio size={32} />
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-indigo-500 group-hover:bg-white transition-colors">
                    <Upload size={32} />
                  </div>
                )}
                
                <div className="space-y-1">
                  <p className="font-bold text-slate-900">
                    {file ? file.name : "點擊或拖放音檔至此"}
                  </p>
                  {file && (
                    <p className="text-xs text-indigo-600 font-medium">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 text-red-600 text-sm animate-in fade-in slide-in-from-top-2">
                <AlertCircle size={18} className="shrink-0" />
                <p className="font-medium">{error}</p>
              </div>
            )}

            <button
              onClick={processAudio}
              disabled={!file || isProcessing}
              className={cn(
                "w-full py-4 rounded-2xl font-bold text-white transition-all duration-300 flex items-center justify-center gap-2 shadow-lg",
                !file || isProcessing
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                  : "bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-1 active:scale-95 shadow-indigo-100"
              )}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>{progress}</span>
                </>
              ) : (
                <>
                  <FileText size={20} />
                  <span>開始生成字幕</span>
                </>
              )}
            </button>
          </div>
        </section>

        {srtContent && (
          <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200/60 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                  <CheckCircle2 size={24} />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-slate-900 text-lg">字幕已生成</h3>
                  <p className="text-slate-500 text-sm">已完成 15 字斷句與間隙補齊</p>
                </div>
              </div>
              
              <button
                onClick={downloadSrt}
                className="flex items-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-all hover:-translate-y-1 active:scale-95 shadow-lg shadow-emerald-100"
              >
                <Download size={20} />
                <span>下載 SRT 檔案</span>
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
