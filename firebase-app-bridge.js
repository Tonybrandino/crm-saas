(function () {
  const state = {
    initialized: false,
    available: false,
    app: null,
    auth: null,
    db: null,
    config: null,
  };

  function getConfig() {
    return window.CRM_FIREBASE_CONFIG || {};
  }

  function hasRequiredConfig(cfg) {
    return !!(
      window.firebase &&
      cfg &&
      cfg.apiKey &&
      cfg.authDomain &&
      cfg.projectId &&
      cfg.appId
    );
  }

  function sanitizePath(path, fallback) {
    return String(path || fallback || "").replace(/^\/+|\/+$/g, "");
  }

  function getUserCollection() {
    return sanitizePath(state.config?.userCollection, "users");
  }

  function getUserDocRef(uid) {
    if (!uid) {
      throw new Error("UID inválido para referência do usuário.");
    }
    return state.db.collection(getUserCollection()).doc(uid);
  }

  function getBootstrapDocRef() {
    const path = sanitizePath(state.config?.stateDocPath, "app/bootstrap");
    return state.db.doc(path);
  }

  function toPlainAuthUser(firebaseUser) {
    if (!firebaseUser) return null;

    return {
      uid: firebaseUser.uid || "",
      email: firebaseUser.email || "",
      displayName: firebaseUser.displayName || "",
      photoURL: firebaseUser.photoURL || "",
      emailVerified: !!firebaseUser.emailVerified,
      providerId:
        firebaseUser.providerData && firebaseUser.providerData[0]
          ? firebaseUser.providerData[0].providerId || "password"
          : "password",
    };
  }

  function normalizeProfile(data = {}, firebaseUser = null) {
    const cfg = state.config || {};
    const authUser = toPlainAuthUser(firebaseUser);

    const uid =
      authUser?.uid ||
      data.firebaseUid ||
      data.uid ||
      data.id ||
      "";

    const email =
      data.email ||
      authUser?.email ||
      "";

    const nome =
      data.nome ||
      data.name ||
      authUser?.displayName ||
      authUser?.email ||
      "Usuário";

    const role =
      data.role ||
      cfg.defaultRole ||
      "admin";

    const active = data.active !== false;

    const mustChange = !!data.mustChange;

    const tenantId =
      data.tenantId !== undefined
        ? data.tenantId
        : (cfg.defaultTenantId !== undefined ? cfg.defaultTenantId : null);

    return {
      id: uid,
      uid,
      firebaseUid: uid,
      nome,
      name: nome,
      email,
      role,
      active,
      mustChange,
      tenantId,
      authProvider: authUser?.providerId || "firebase",
      created:
        data.created ||
        data.createdAt ||
        new Date().toISOString(),
    };
  }

  async function init() {
    if (state.initialized) return state;

    state.initialized = true;
    state.config = getConfig();

    if (!hasRequiredConfig(state.config)) {
      state.available = false;
      return state;
    }

    state.app = window.firebase.apps && window.firebase.apps.length
      ? window.firebase.app()
      : window.firebase.initializeApp(state.config);

    state.auth = window.firebase.auth();
    state.db = window.firebase.firestore();
    state.available = true;

    return state;
  }

  async function readUserProfile(firebaseUser) {
    await init();

    if (!state.available || !firebaseUser?.uid) {
      return null;
    }

    let snap = await getUserDocRef(firebaseUser.uid).get();

    if (!snap.exists && state.config?.lookupUserByEmail !== false && firebaseUser.email) {
      const query = await state.db
        .collection(getUserCollection())
        .where("email", "==", firebaseUser.email)
        .limit(1)
        .get();

      if (!query.empty) {
        snap = query.docs[0];
      }
    }

    if (!snap.exists) {
      return null;
    }

    return normalizeProfile(
      { id: snap.id, ...snap.data() },
      firebaseUser
    );
  }

  async function getCurrentUserProfile(uid) {
    await init();

    if (!state.available || !uid) {
      return null;
    }

    const currentAuthUser = state.auth?.currentUser || null;

    if (currentAuthUser?.uid === uid) {
      const currentProfile = await readUserProfile(currentAuthUser);
      if (currentProfile) return currentProfile;
    }

    const snap = await getUserDocRef(uid).get();
    if (!snap.exists) return null;

    return normalizeProfile(
      { id: snap.id, ...snap.data() },
      { uid, email: snap.data()?.email || "" }
    );
  }

  async function loginRaw(email, password) {
    await init();

    if (!state.available || !state.config?.enableFirebaseAuth) {
      throw new Error("Firebase Auth não está habilitado.");
    }

    const cred = await state.auth.signInWithEmailAndPassword(email, password);
    return toPlainAuthUser(cred.user);
  }

  async function login(email, password) {
    await init();

    if (!state.available || !state.config?.enableFirebaseAuth) {
      throw new Error("Firebase Auth não está habilitado.");
    }

    const cred = await state.auth.signInWithEmailAndPassword(email, password);
    const authUser = toPlainAuthUser(cred.user);
    const profile = await readUserProfile(cred.user);

    if (!profile) {
      throw new Error("Perfil do usuário não encontrado no Firestore.");
    }

    return {
      uid: authUser.uid,
      email: authUser.email,
      displayName: authUser.displayName,
      photoURL: authUser.photoURL,
      providerId: authUser.providerId,
      nome: profile.nome,
      name: profile.nome,
      role: profile.role,
      active: profile.active,
      mustChange: profile.mustChange,
      tenantId: profile.tenantId,
      profile,
    };
  }

  async function logout() {
    await init();

    if (!state.available) return;
    await state.auth.signOut();
  }

  async function sendPasswordReset(email) {
    await init();

    if (!state.available || !state.config?.enableFirebaseAuth) {
      return false;
    }

    await state.auth.sendPasswordResetEmail(email);
    return true;
  }

  async function updateCurrentPassword(nextPassword) {
    await init();

    const current = state.auth?.currentUser;
    if (!state.available || !current) {
      throw new Error("Nenhum usuário autenticado.");
    }

    await current.updatePassword(nextPassword);
    return true;
  }

  async function getCurrentSessionProfile() {
    await init();

    const current = state.auth?.currentUser;
    if (!state.available || !current) {
      return null;
    }

    return readUserProfile(current);
  }

  async function listUsers() {
    await init();

    if (!state.available) return [];

    const snap = await state.db.collection(getUserCollection()).get();

    return snap.docs
      .map((doc) =>
        normalizeProfile(
          { id: doc.id, ...doc.data() },
          { uid: doc.id, email: doc.data()?.email || "" }
        )
      )
      .sort((a, b) =>
        String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", {
          sensitivity: "base",
        })
      );
  }

  async function createUser(payload) {
    await init();

    if (!state.available) {
      throw new Error("Firebase não disponível.");
    }

    if (!payload?.email || !payload?.password) {
      throw new Error("E-mail e senha são obrigatórios para criar usuário.");
    }

    const tempAppName = "crm-user-" + Date.now();
    const secondaryApp = window.firebase.initializeApp(state.config, tempAppName);
    const secondaryAuth = secondaryApp.auth();

    try {
      const cred = await secondaryAuth.createUserWithEmailAndPassword(
        payload.email,
        payload.password
      );

      const profile = normalizeProfile(
        {
          id: cred.user.uid,
          uid: cred.user.uid,
          nome: payload.nome || payload.name || payload.email,
          name: payload.nome || payload.name || payload.email,
          email: payload.email,
          role: payload.role || state.config?.defaultRole || "admin",
          active: payload.active !== false,
          mustChange: payload.mustChange !== false,
          tenantId:
            payload.tenantId !== undefined
              ? payload.tenantId
              : (state.config?.defaultTenantId !== undefined
                  ? state.config.defaultTenantId
                  : null),
          created: new Date().toISOString(),
        },
        cred.user
      );

      await getUserDocRef(cred.user.uid).set(
        {
          nome: profile.nome,
          name: profile.nome,
          email: profile.email,
          role: profile.role,
          active: profile.active,
          mustChange: profile.mustChange,
          tenantId: profile.tenantId,
          created: profile.created,
        },
        { merge: true }
      );

      await secondaryAuth.signOut();
      return profile;
    } finally {
      await secondaryApp.delete().catch(() => {});
    }
  }

  async function updateUser(userId, patch) {
    await init();

    if (!state.available || !userId) {
      return false;
    }

    const next = { ...(patch || {}) };

    if (next.nome && !next.name) {
      next.name = next.nome;
    }

    if (next.name && !next.nome) {
      next.nome = next.name;
    }

    await getUserDocRef(userId).set(next, { merge: true });
    return true;
  }

  async function archiveUser(userId) {
    await init();

    if (!state.available || !userId) {
      return false;
    }

    await getUserDocRef(userId).set(
      {
        active: false,
        archivedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return true;
  }

  async function sendUserPasswordReset(email) {
    return sendPasswordReset(email);
  }

  async function fetchStateSnapshot() {
    await init();

    if (!state.available || !state.config?.enableFirestoreSync) {
      return null;
    }

    const snap = await getBootstrapDocRef().get();
    return snap.exists ? snap.data() : null;
  }

  async function saveStateSnapshot(payload) {
    await init();

    if (!state.available || !state.config?.enableFirestoreSync) {
      return false;
    }

    await getBootstrapDocRef().set(
      {
        ...(payload || {}),
        updatedAt: new Date().toISOString(),
        source: "web-crm",
      },
      { merge: true }
    );

    return true;
  }

  window.firebaseAuthBridge = {
    init,
    login,
    loginRaw,
    logout,
    sendPasswordReset,
    updateCurrentPassword,
    getCurrentSessionProfile,
    getCurrentUserProfile,
    listUsers,
    createUser,
    updateUser,
    archiveUser,
    sendUserPasswordReset,
    fetchStateSnapshot,
    saveStateSnapshot,
    isAvailable: function () {
      return !!state.available;
    },
    isAuthEnabled: function () {
      return !!(state.available && state.config?.enableFirebaseAuth);
    },
    isSyncEnabled: function () {
      return !!(state.available && state.config?.enableFirestoreSync);
    },
  };
})();
