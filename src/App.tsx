import React, { useState, useEffect } from 'react';
import { auth, db, signInWithGoogle, logOut } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { LogIn, LogOut, User as UserIcon, Coins, Sparkles, Loader2, X, MessageCircle, CreditCard } from 'lucide-react';
import StableV1 from './versions/StableV1';
import HistoryV2 from './versions/HistoryV2';
import BilingualV3 from './versions/BilingualV3';

type Version = 'V1' | 'V2' | 'V3';

// 額度不足彈窗組件
function QuotaModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <Coins size={40} />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-slate-900">額度不足</h3>
            <p className="text-slate-500">您的剩餘分鐘數不足以轉錄此音檔。請購買更多額度以繼續使用專業服務。</p>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            <a 
              href="mailto:theoder@gmail.com?subject=購買 VoxFlow Pro 額度" 
              className="flex items-center justify-center gap-2 w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              <MessageCircle size={20} />
              聯絡客服購買 (Email)
            </a>
            <button 
              onClick={onClose}
              className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
            >
              稍後再說
            </button>
          </div>
        </div>
        <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">VoxFlow Pro • 商業營運模式</p>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [activeVersion, setActiveVersion] = useState<Version>('V3');
  const [user, setUser] = useState<User | null>(null);
  const [quota, setQuota] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await initializeUserProfile(currentUser);
        const userDocRef = doc(db, "users", currentUser.uid);
        const unsubSnapshot = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) setQuota(docSnap.data().quota || 0);
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

  const initializeUserProfile = async (currentUser: User) => {
    const userDocRef = doc(db, "users", currentUser.uid);
    const docSnap = await getDoc(userDocRef);
    if (!docSnap.exists()) {
      await setDoc(userDocRef, {
        email: currentUser.email,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL,
        quota: 10,
        createdAt: new Date().toISOString()
      });
    }
  };

  const handleLogin = async () => {
    try { await signInWithGoogle(); } catch (error) { console.error(error); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      <QuotaModal isOpen={isQuotaModalOpen} onClose={() => setIsQuotaModalOpen(false)} />
      
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200">
              <Sparkles className="text-white" size={18} />
            </div>
            <span className="text-xl font-black tracking-tight">VoxFlow <span className="text-indigo-600">Pro</span></span>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setIsQuotaModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-full border border-amber-100 hover:bg-amber-100 transition-all group"
                >
                  <Coins size={14} className="text-amber-600" />
                  <span className="text-xs font-bold text-amber-700">剩餘: {quota} 分鐘</span>
                  <div className="w-5 h-5 bg-amber-600 text-white rounded-full flex items-center justify-center text-[12px] font-black group-hover:scale-110 transition-transform shadow-sm">
                    +
                  </div>
                </button>
                
                <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                  <img src={user.photoURL || ''} alt="User" className="w-8 h-8 rounded-full border border-slate-200" />
                  <button onClick={() => logOut()} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><LogOut size={20} /></button>
                </div>
              </div>
            ) : (
              <button onClick={handleLogin} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"><LogIn size={18} />Google 登入</button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {user ? (
          <div className="space-y-12">
            <div className="flex justify-center">
              <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200/60 flex gap-1">
                {(['V1', 'V3'] as Version[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setActiveVersion(v)}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      activeVersion === v ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {v === 'V1' ? 'V1 Stable' : 'V3 Bilingual'}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-[600px]">
              {activeVersion === 'V1' && <StableV1 user={user} onOpenQuotaModal={() => setIsQuotaModalOpen(true)} />}
              {/* {activeVersion === 'V2' && <HistoryV2 user={user} onOpenQuotaModal={() => setIsQuotaModalOpen(true)} />} */}
              {activeVersion === 'V3' && <BilingualV3 user={user} onOpenQuotaModal={() => setIsQuotaModalOpen(true)} />}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 space-y-8 text-center">
            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center shadow-inner"><UserIcon size={40} /></div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-slate-900">歡迎來到 VoxFlow Pro</h2>
              <p className="text-slate-500 max-w-md mx-auto">請先登入您的帳號，即可開始使用專業的 AI 語音轉錄與翻譯服務。</p>
            </div>
            <button onClick={handleLogin} className="flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"><LogIn size={24} />使用 Google 帳號登入</button>
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-slate-200/60 text-center">
        <p className="text-slate-400 text-sm font-medium">© 2024 VoxFlow Pro Lab • Professional Transcription Ecosystem</p>
      </footer>
    </div>
  );
}

export default App;