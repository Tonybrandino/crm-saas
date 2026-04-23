import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAoew773eW5XCmbYDXoSDuPk390Igew-gw",
  authDomain: "crm-saas-1d922.firebaseapp.com",
  projectId: "crm-saas-1d922",
  storageBucket: "crm-saas-1d922.firebasestorage.app",
  messagingSenderId: "321293146304",
  appId: "1:321293146304:web:dcd3041d589829f941f525"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updatePassword,
  doc,
  setDoc,
  getDoc,
  serverTimestamp
};
