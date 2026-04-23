import {
  auth,
  db,
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
} from "./firebase-config.js";

window.firebaseAuthBridge = {
  isAuthEnabled() {
    return !!auth;
  },

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

  async sendPasswordReset(email) {
    await sendPasswordResetEmail(auth, email);
  },

  async logout() {
    await signOut(auth);
  },

  async updateCurrentPassword(newPassword) {
    if (!auth.currentUser) throw new Error("Nenhum usuário autenticado.");
    await updatePassword(auth.currentUser, newPassword);
  },

  async getCurrentUserProfile(uid) {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  },

  onAuthChanged(callback) {
    return onAuthStateChanged(auth, callback);
  }
};
