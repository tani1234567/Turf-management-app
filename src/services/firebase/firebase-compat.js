// Initialize Firebase compat SDK for web (required by expo-firebase-recaptcha)
import firebase from "firebase/compat/app";
import "firebase/compat/auth";

// Firebase configuration (duplicated to avoid circular dependency)
const firebaseConfig = {
  apiKey: "AIzaSyA7SFtJeh00Qd5ykQ9dBGhN1BZTPLQ8SpM",
  authDomain: "sowin-power.firebaseapp.com",
  projectId: "sowin-power",
  storageBucket: "sowin-power.firebasestorage.app",
  messagingSenderId: "198947395530",
  appId: "1:198947395530:web:dfa339b9f95d2984996133",
};

// Initialize compat app if not already initialized
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export default firebase;
