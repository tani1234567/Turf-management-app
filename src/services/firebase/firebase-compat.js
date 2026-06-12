// Initialize Firebase compat SDK for web (required by expo-firebase-recaptcha)
import firebase from "firebase/compat/app";
import "firebase/compat/auth";

// Firebase configuration (duplicated to avoid circular dependency)
const firebaseConfig = {
  apiKey: "AIzaSyC-XsYP8CB7r55vFqlh2bolYkurREHRL-s",
  authDomain: "sportsphere-1701.firebaseapp.com",
  projectId: "sportsphere-1701",
  storageBucket: "sportsphere-1701.firebasestorage.app",
  messagingSenderId: "811353302109",
  appId: "1:811353302109:web:44d85c2a6267ef898419b4",
  measurementId: "G-JS7Z7FT584",
};

// Initialize compat app if not already initialized
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export default firebase;
