window.CRM_FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  defaultTenantId: "tenant-demo",
  enableFirebaseAuth: false,
  enableFirestoreSync: false
};
// Firebase via CDN (funciona direto no navegador)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAoew773eW5XCmbYDXoSDuPk390Igew-gw",
  authDomain: "crm-saas-1d922.firebaseapp.com",
  projectId: "crm-saas-1d922",
  storageBucket: "crm-saas-1d922.firebasestorage.app",
  messagingSenderId: "321293146304",
  appId: "1:321293146304:web:dcd3041d589829f941f525"
};

// Inicializa
const app = initializeApp(firebaseConfig);

// Serviços
export const auth = getAuth(app);
export const db = getFirestore(app);
