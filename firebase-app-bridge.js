import {
  auth,
  db,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "./firebase-config.js";

window.firebaseAuthBridge = {
  async login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  },

  async register({ nome, email, password, role = "admin" }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    await setDoc(doc(db, "users", cred.user.uid), {
      uid: cred.user.uid,
      nome,
      email,
      role,
      active: true,
      createdAt: serverTimestamp()
    });

    return cred.user;
  },

  async resetPassword(email) {
    await sendPasswordResetEmail(auth, email);
  },

  async logout() {
    await signOut(auth);
  },

  async getCurrentUserProfile(uid) {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  },

  onAuthChanged(callback) {
    return onAuthStateChanged(auth, callback);
  }
};
window.addEventListener('DOMContentLoaded', () => {
  if (!window.firebaseAuthBridge) return;

  window.firebaseAuthBridge.onAuthChanged(async (user) => {
    if (!user) return;

    try {
      const profile = await window.firebaseAuthBridge.getCurrentUserProfile(user.uid);
      if (!profile || profile.active === false) return;

      currentUser = {
        id: user.uid,
        nome: profile.nome || user.email,
        email: user.email,
        role: profile.role || 'viewer',
        active: profile.active !== false,
        firebaseUid: user.uid
      };

      enterApp();
    } catch (e) {
      console.error(e);
    }
  });
});
