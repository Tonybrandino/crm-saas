(function(){
  const state = {
    initialized: false,
    available: false,
    app: null,
    auth: null,
    db: null,
    config: null,
  };

  function hasFirebaseRuntime(){
    return !!(window.firebase && window.CRM_FIREBASE_CONFIG);
  }

  function getTenantId(userProfile){
    return userProfile?.tenantId || state.config?.defaultTenantId || 'tenant-demo';
  }

  async function init(){
    if(state.initialized) return state;
    state.initialized = true;
    state.config = window.CRM_FIREBASE_CONFIG || null;
    if(!hasFirebaseRuntime()) return state;
    state.app = window.firebase.apps?.length
      ? window.firebase.app()
      : window.firebase.initializeApp(state.config);
    state.auth = window.firebase.auth();
    state.db = window.firebase.firestore();
    state.available = true;
    return state;
  }

  async function readUserProfile(firebaseUser){
    await init();
    if(!state.available || !firebaseUser) return null;
    const tenantId = state.config.defaultTenantId || 'tenant-demo';
    const ref = state.db.doc(`tenants/${tenantId}/users/${firebaseUser.uid}`);
    const snap = await ref.get();
    if(!snap.exists) return null;
    const data = snap.data() || {};
    return {
      id: firebaseUser.uid,
      firebaseUid: firebaseUser.uid,
      nome: data.nome || firebaseUser.displayName || firebaseUser.email || 'Usuário',
      email: data.email || firebaseUser.email || '',
      role: data.role || 'viewer',
      active: data.active !== false,
      mustChange: false,
      tenantId,
      authProvider: 'firebase',
    };
  }

  async function signIn(email, password){
    await init();
    if(!state.available || !state.config?.enableFirebaseAuth) return null;
    const cred = await state.auth.signInWithEmailAndPassword(email, password);
    return readUserProfile(cred.user);
  }

  async function signOut(){
    await init();
    if(!state.available) return;
    await state.auth.signOut();
  }

  async function sendPasswordReset(email){
    await init();
    if(!state.available || !state.config?.enableFirebaseAuth) return false;
    await state.auth.sendPasswordResetEmail(email);
    return true;
  }

  async function updateCurrentPassword(nextPassword){
    await init();
    const current = state.auth?.currentUser;
    if(!state.available || !current) return false;
    await current.updatePassword(nextPassword);
    return true;
  }

  async function getCurrentSessionProfile(){
    await init();
    const current = state.auth?.currentUser;
    if(!state.available || !current) return null;
    return readUserProfile(current);
  }

  async function fetchTenantSnapshot(tenantId){
    await init();
    if(!state.available || !state.config?.enableFirestoreSync) return null;
    const ref = state.db.doc(`tenants/${tenantId}/app/bootstrap`);
    const snap = await ref.get();
    return snap.exists ? snap.data() : null;
  }

  async function saveTenantSnapshot(tenantId, payload){
    await init();
    if(!state.available || !state.config?.enableFirestoreSync) return false;
    const ref = state.db.doc(`tenants/${tenantId}/app/bootstrap`);
    await ref.set({
      ...payload,
      tenantId,
      updatedAt: new Date().toISOString(),
      source: 'web-crm'
    }, { merge:true });
    return true;
  }

  window.crmFirebaseBridge = {
    init,
    signIn,
    signOut,
    sendPasswordReset,
    updateCurrentPassword,
    getCurrentSessionProfile,
    fetchTenantSnapshot,
    saveTenantSnapshot,
    isAvailable: () => !!state.available,
    isAuthEnabled: () => !!(state.available && state.config?.enableFirebaseAuth),
    isSyncEnabled: () => !!(state.available && state.config?.enableFirestoreSync),
    getTenantId,
  };
})();
