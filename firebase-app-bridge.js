(function(){
  const state = {
    initialized: false,
    available: false,
    app: null,
    auth: null,
    db: null,
    config: null,
  };

  function getConfig(){
    return window.CRM_FIREBASE_CONFIG || {};
  }

  function hasFirebaseRuntime(){
    const cfg = getConfig();
    return !!(
      window.firebase &&
      cfg &&
      cfg.apiKey &&
      cfg.authDomain &&
      cfg.projectId &&
      cfg.appId
    );
  }

  function getUserCollection(){
    return (state.config?.userCollection || 'users').replace(/^\/+|\/+$/g, '');
  }

  function getUserDocRef(uid){
    return state.db.collection(getUserCollection()).doc(uid);
  }

  function getBootstrapDocRef(){
    const path = (state.config?.stateDocPath || 'app/bootstrap').replace(/^\/+|\/+$/g, '');
    const parts = path.split('/');
    let ref = state.db.collection(parts[0]);
    for(let i=1; i<parts.length; i+=2){
      ref = ref.doc(parts[i-1] === parts[0] && i === 1 ? parts[i] : parts[i]);
      if(parts[i + 1]) ref = ref.collection(parts[i + 1]);
    }
    return state.db.doc(path);
  }

  function normalizeProfile(data={}, firebaseUser=null){
    const cfg = state.config || {};
    return {
      id: firebaseUser?.uid || data.id || '',
      firebaseUid: firebaseUser?.uid || data.firebaseUid || data.uid || '',
      nome: data.nome || data.name || firebaseUser?.displayName || firebaseUser?.email || 'Usuário',
      email: data.email || firebaseUser?.email || '',
      role: data.role || cfg.defaultRole || 'admin',
      active: data.active !== false,
      mustChange: !!data.mustChange,
      tenantId: data.tenantId || cfg.defaultTenantId || 'tenant-demo',
      authProvider: 'firebase',
      created: data.created || new Date().toLocaleDateString('pt-BR'),
    };
  }

  async function init(){
    if(state.initialized) return state;
    state.initialized = true;
    state.config = getConfig();
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
    let snap = await getUserDocRef(firebaseUser.uid).get();

    if(!snap.exists && state.config?.lookupUserByEmail !== false && firebaseUser.email){
      const query = await state.db
        .collection(getUserCollection())
        .where('email', '==', firebaseUser.email)
        .limit(1)
        .get();
      if(!query.empty) snap = query.docs[0];
    }

    if(!snap.exists){
      return normalizeProfile({
        name: firebaseUser.displayName || firebaseUser.email || 'Usuário',
        email: firebaseUser.email || '',
        role: state.config?.defaultRole || 'admin',
        active: true,
      }, firebaseUser);
    }

    return normalizeProfile(snap.data() || {}, firebaseUser);
  }

  async function login(email, password){
    await init();
    if(!state.available || !state.config?.enableFirebaseAuth) return null;
    const cred = await state.auth.signInWithEmailAndPassword(email, password);
    return readUserProfile(cred.user);
  }

  async function logout(){
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

  async function listUsers(){
    await init();
    if(!state.available) return [];
    const snap = await state.db.collection(getUserCollection()).orderBy('name', 'asc').get();
    return snap.docs.map(doc => normalizeProfile({ id: doc.id, ...doc.data() }, { uid: doc.id, email: doc.data().email || '' }));
  }

  async function createUser(payload){
    await init();
    if(!state.available) return null;
    const tempAppName = `crm-user-${Date.now()}`;
    const secondaryApp = window.firebase.initializeApp(state.config, tempAppName);
    const secondaryAuth = secondaryApp.auth();
    try{
      const cred = await secondaryAuth.createUserWithEmailAndPassword(payload.email, payload.password);
      const profile = normalizeProfile({
        id: cred.user.uid,
        name: payload.nome,
        email: payload.email,
        role: payload.role || state.config?.defaultRole || 'admin',
        active: payload.active !== false,
        mustChange: true,
        tenantId: payload.tenantId || state.config?.defaultTenantId || 'tenant-demo',
      }, cred.user);
      await getUserDocRef(cred.user.uid).set({
        name: profile.nome,
        email: profile.email,
        role: profile.role,
        active: profile.active,
        mustChange: profile.mustChange,
        tenantId: profile.tenantId,
        created: profile.created,
      }, { merge:true });
      await secondaryAuth.signOut();
      return profile;
    } finally {
      await secondaryApp.delete().catch(() => {});
    }
  }

  async function updateUser(userId, patch){
    await init();
    if(!state.available) return false;
    const next = { ...patch };
    if(next.nome && !next.name) next.name = next.nome;
    delete next.nome;
    await getUserDocRef(userId).set(next, { merge:true });
    return true;
  }

  async function archiveUser(userId){
    await init();
    if(!state.available) return false;
    await getUserDocRef(userId).set({
      active: false,
      archivedAt: new Date().toISOString(),
    }, { merge:true });
    return true;
  }

  async function sendUserPasswordReset(email){
    return sendPasswordReset(email);
  }

  async function fetchStateSnapshot(){
    await init();
    if(!state.available || !state.config?.enableFirestoreSync) return null;
    const snap = await getBootstrapDocRef().get();
    return snap.exists ? snap.data() : null;
  }

  async function saveStateSnapshot(payload){
    await init();
    if(!state.available || !state.config?.enableFirestoreSync) return false;
    await getBootstrapDocRef().set({
      ...payload,
      updatedAt: new Date().toISOString(),
      source: 'web-crm'
    }, { merge:true });
    return true;
  }

  window.firebaseAuthBridge = {
    init,
    login,
    logout,
    sendPasswordReset,
    updateCurrentPassword,
    getCurrentSessionProfile,
    listUsers,
    createUser,
    updateUser,
    archiveUser,
    sendUserPasswordReset,
    fetchStateSnapshot,
    saveStateSnapshot,
    isAvailable: () => !!state.available,
    isAuthEnabled: () => !!(state.available && state.config?.enableFirebaseAuth),
    isSyncEnabled: () => !!(state.available && state.config?.enableFirestoreSync),
  };
})();
