import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDN_LUQErSWliOoEYwbbb8xMj6Nst8V25U",
  authDomain: "trivo-chat-servers.firebaseapp.com",
  projectId: "trivo-chat-servers",
  storageBucket: "trivo-chat-servers.firebasestorage.app",
  messagingSenderId: "746221864556",
  appId: "1:746221864556:web:459deb88791fde81727a49",
  measurementId: "G-JPECYPD8RK",
  databaseURL: "https://trivo-chat-servers-default-rtdb.firebaseio.com",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseStorage = getStorage(firebaseApp);
export const db = getFirestore(firebaseApp);
export const auth = getAuth(firebaseApp);

let analyticsInstance: any = null;

isSupported().then((supported) => {
  if (supported) {
    analyticsInstance = getAnalytics(firebaseApp);
  }
}).catch(() => {});

export const getFirebaseAnalytics = () => analyticsInstance;
