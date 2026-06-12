import { initializeApp } from "firebase/app";
import { initializeAuth, getAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";

export const firebaseConfig = {
  apiKey: "AIzaSyC-XsYP8CB7r55vFqlh2bolYkurREHRL-s",
  authDomain: "sportsphere-1701.firebaseapp.com",
  projectId: "sportsphere-1701",
  storageBucket: "sportsphere-1701.firebasestorage.app",
  messagingSenderId: "811353302109",
  appId: "1:811353302109:web:44d85c2a6267ef898419b4",
  measurementId: "G-JS7Z7FT584",
};

const app = initializeApp(firebaseConfig);

// On native, persist auth state via AsyncStorage (no iOS Keychain required).
// On web, use the default browser localStorage persistence.
let auth;
if (Platform.OS !== "web") {
  const AsyncStorage =
    require("@react-native-async-storage/async-storage").default;
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} else {
  auth = getAuth(app);
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
