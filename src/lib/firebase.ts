import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// --- 請將下方這段替換成您在 Firebase 看到的內容 ---
const firebaseConfig = {
  apiKey: "AIzaSyBge5NcCflxCHiRzcAL7jOxDDWXUjgdxRE",
  authDomain: "voxflow-pro.firebaseapp.com",
  projectId: "voxflow-pro",
  storageBucket: "voxflow-pro.firebasestorage.app",
  messagingSenderId: "957058122655",
  appId: "1:957058122655:web:c0f6655d7016697e1873aa"
};
// ----------------------------------------------

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// 登入函數
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
// 登出函數
export const logOut = () => signOut(auth);