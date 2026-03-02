import React, { useState, useEffect } from 'react';
import { auth, db, signInWithGoogle, logOut } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { LogIn, LogOut, User as UserIcon, Coins, Sparkles, Loader2 } from 'lucide-react';
import StableV1 from './versions/StableV1';
import HistoryV2 from './versions/HistoryV2';
import BilingualV3 from './versions/BilingualV3';

type Version = 'V1' | 'V2' | 'V3';

function App() {
  const [activeVersion, setActiveVersion] = useState<Version>('V3');
  const [user, setUser] = useState<User | null>(null);
  const [quota, setQuota] = useState<number>(0); // 實時額度
  const [loading, setLoading] = useState(true);

  // 1. 監聽登入狀態
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // 2. 登入後，檢查或建立使用者資料
        await initializeUserProfile(currentUser);
        
        // 3. 實時監聽使用者的額度變化
        const userDocRef = doc(db, "users", currentUser.uid);
        const unsubSnapshot = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setQuota(docSnap.data().quota || 0);
          }
        });

        setLoading(false);
        return () => unsubSnapshot();
      } else {
        setQuota(0);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // 初始化使用者資料：如果是新用戶，送 60 分鐘
  const initializeUserProfile = async (currentUser: User) => {
    const userDocRef = doc(db, "users", currentUser.uid);
    const docSnap = await getDoc(userDocRef);

    if (!docSnap.exists()) {
      // 新用戶：建立文件並贈送 60 分鐘
      await setDoc(userDocRef, {
        email: currentUser.email,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL,
        quota: 60, // 贈送 60 分鐘
        createdAt: new Date().toISOString()
      });
      console.log("新用戶已開戶，贈送 60 分鐘！");
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("登入失敗:", error);
      alert("登入失敗，請稍後再試。");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-indigo-600" size={40} />
          <p className="text-slate-400 font-medium tracking-widest uppercase text-xs">VoxFlow Pro 載入中</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-700">
      {/* 導航欄 */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200">
              <Sparkles className="text-white" size={18} />
            </div>
            <span className="text-xl font-black tracking-tight text-slate-900">VoxFlow <span className="text-indigo-600">Pro</span></span>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                {/* 真實額度顯示 */}
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-full border border-amber-100">
                  <Coins size={14} className="text-amber-600" />
                  <span className="text-xs font-bold text-amber-700">剩餘額度: {quota} 分鐘</span>
                </div>
                
                <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                  <img src={user.photoURL || ''} alt="User" className="w-8 h-8 rounded-full border border-slate-200" />
                  <button 
                    onClick={() => logOut()}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    title="登出"
                  >
                    <LogOut size={20} />
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
              >
                <LogIn size={18} />
                Google 登入
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {user ? (
          <div className="space-y-12">
            {/* 版本切換器 */}
            <div className="flex justify-center">
              <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200/60 flex gap-1">
                {(['V1', 'V2', 'V3'] as Version[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setActiveVersion(v)}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      activeVersion === v
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {v === 'V1' ? 'V1 Stable' : v === 'V2' ? 'V2 History' : 'V3 Bilingual'}
                  </button>
                ))}
              </div>
            </div>

            {/* 內容區 */}
            <div className="min-h-[600px]">
              {activeVersion === 'V1' && <StableV1 user={user} />}
              {activeVersion === 'V2' && <HistoryV2 user={user} />}
              {activeVersion === 'V3' && <BilingualV3 user={user} />}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 space-y-8 text-center">
            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center shadow-inner">
              <UserIcon size={40} />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-slate-900">歡迎來到 VoxFlow Pro</h2>
              <p className="text-slate-500 max-w-md mx-auto">請先登入您的帳號，即可開始使用專業的 AI 語音轉錄與翻譯服務。</p>
            </div>
            <button 
              onClick={handleLogin}
              className="flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
            >
              <LogIn size={24} />
              使用 Google 帳號登入
            </button>
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-slate-200/60">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-slate-400 text-sm font-medium">© 2024 VoxFlow Pro Lab • Professional Transcription Ecosystem</p>
          <div className="flex gap-8">
            <a href="#" className="text-slate-400 hover:text-indigo-600 text-sm font-bold transition-colors">隱私條款</a>
            <a href="#" className="text-slate-400 hover:text-indigo-600 text-sm font-bold transition-colors">服務協議</a>
            <a href="#" className="text-slate-400 hover:text-indigo-600 text-sm font-bold transition-colors">聯絡我們</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;