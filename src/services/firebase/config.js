import { initializeApp } from "firebase/app";
import { initializeAuth, getAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";

export const firebaseConfig = {
  apiKey: "AIzaSyA7SFtJeh00Qd5ykQ9dBGhN1BZTPLQ8SpM",
  authDomain: "sowin-power.firebaseapp.com",
  projectId: "sowin-power",
  storageBucket: "sowin-power.firebasestorage.app",
  messagingSenderId: "198947395530",
  appId: "1:198947395530:web:dfa339b9f95d2984996133",
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
