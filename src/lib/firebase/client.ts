import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// HARD-CODED TRUTH: NO ENV VARS
const firebaseConfig = {
  projectId: "project-solo-6b864",
  appId: "1:17148879024:web:6e7911f0348ab43e569b75",
  storageBucket: "project-solo-6b864.firebasestorage.app",
  apiKey: "AIzaSyDSE_CpaBmyLT6OqDzGg3aURoelO1My0Rc",
  authDomain: "project-solo-6b864.firebaseapp.com",
  messagingSenderId: "17148879024",
  measurementId: "G-BLM3TGSZTR"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
console.log("SUCESS: Firebase Client hooked to project-solo-6b864");
