import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyA7SFtJeh00Qd5ykQ9dBGhN1BZTPLQ8SpM",
  authDomain: "sowin-power.firebaseapp.com",
  projectId: "sowin-power",
  storageBucket: "sowin-power.firebasestorage.app",
  messagingSenderId: "198947395530",
  appId: "1:198947395530:web:dfa339b9f95d2984996133",
};

// Initialize Firebase (modular SDK)
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
