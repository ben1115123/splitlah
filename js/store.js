// Data layer. Two interchangeable backends with the same API:
//   - Firebase Firestore (shared between friends, realtime, works offline)
//   - Local demo mode (this device only) when config.js has no Firebase keys
//
// Layout:  groups/{groupId}                 -> group doc (name, currency, members map, rates…)
//          groups/{groupId}/expenses/{id}   -> expense or payment

const FB = '10.12.2';
const CDN = `https://www.gstatic.com/firebasejs/${FB}`;

export function newId(len = 20) {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let s = '';
  for (const b of bytes) s += abc[b % abc.length];
  return s;
}

function setPath(obj, path, value) {
  const parts = path.split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof o[parts[i]] !== 'object' || o[parts[i]] === null) o[parts[i]] = {};
    o = o[parts[i]];
  }
  if (value === DELETE) delete o[parts.at(-1)];
  else o[parts.at(-1)] = value;
}
const DELETE = Symbol('delete');

/* ---------------- Firebase ---------------- */
async function firebaseStore(config) {
  const [{ initializeApp }, auth, fs] = await Promise.all([
    import(`${CDN}/firebase-app.js`),
    import(`${CDN}/firebase-auth.js`),
    import(`${CDN}/firebase-firestore.js`),
  ]);
  const app = initializeApp(config);
  let db;
  try {
    db = fs.initializeFirestore(app, {
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
      ignoreUndefinedProperties: true,
    });
  } catch {
    db = fs.getFirestore(app);
  }
  const a = auth.getAuth(app);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error('Timed out signing in to Firebase'), { code: 'auth/timeout' })), 15000);
    const done = (u) => { clearTimeout(timer); resolve(u); };
    const off = auth.onAuthStateChanged(a, (u) => {
      if (u) { off(); done(u); }
    });
    auth.signInAnonymously(a).catch((e) => {
      // Offline with an existing session still works; otherwise report.
      if (a.currentUser) done(a.currentUser); else { clearTimeout(timer); reject(e); }
    });
  });

  const gref = (id) => fs.doc(db, 'groups', id);
  const eref = (gid, id) => fs.doc(db, 'groups', gid, 'expenses', id);
  const toPatch = (patch) => {
    const out = {};
    for (const [k, v] of Object.entries(patch)) out[k] = v === DELETE ? fs.deleteField() : v;
    return out;
  };

  return {
    mode: 'firebase',
    DELETE,
    async createGroup(data) {
      // Firestore applies the write locally straight away and syncs in the background,
      // so creating a group works offline too. Server rejections are reported via onWriteError.
      const id = newId();
      fs.setDoc(gref(id), data).catch((e) => this.onWriteError?.(e));
      return id;
    },
    onWriteError: null,
    async getGroup(id) {
      const s = await fs.getDoc(gref(id));
      return s.exists() ? { id, ...s.data() } : null;
    },
    watchGroup(id, cb, err) {
      return fs.onSnapshot(gref(id), (s) => cb(s.exists() ? { id, ...s.data() } : null), err);
    },
    updateGroup(id, patch) {
      return fs.updateDoc(gref(id), toPatch(patch));
    },
    watchExpenses(gid, cb, err) {
      return fs.onSnapshot(fs.collection(db, 'groups', gid, 'expenses'), (snap) => {
        cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })), snap.metadata.hasPendingWrites);
      }, err);
    },
    saveExpense(gid, exp) {
      const { id, ...data } = exp;
      return fs.setDoc(eref(gid, id), data);
    },
  };
}

/* ---------------- Local (demo) ---------------- */
function localStore() {
  const KEY = 'splitlah.localdb.v1';
  const listeners = new Set();
  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || { groups: {} }; } catch { return { groups: {} }; }
  };
  let mem = load();
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch {}
    queueMicrotask(() => listeners.forEach((l) => l()));
  };
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) { mem = load(); listeners.forEach((l) => l()); }
  });
  const sub = (fn) => { listeners.add(fn); queueMicrotask(fn); return () => listeners.delete(fn); };
  const clone = (x) => JSON.parse(JSON.stringify(x));

  return {
    mode: 'local',
    DELETE,
    onWriteError: null,
    async createGroup(data) {
      const id = newId();
      mem.groups[id] = { data: clone(data), expenses: {} };
      save();
      return id;
    },
    async getGroup(id) {
      const g = mem.groups[id];
      return g ? { id, ...clone(g.data) } : null;
    },
    watchGroup(id, cb) {
      return sub(() => { const g = mem.groups[id]; cb(g ? { id, ...clone(g.data) } : null); });
    },
    async updateGroup(id, patch) {
      const g = mem.groups[id];
      if (!g) throw new Error('Group not found');
      for (const [k, v] of Object.entries(patch)) setPath(g.data, k, v === DELETE ? DELETE : clone(v));
      save();
    },
    watchExpenses(gid, cb) {
      return sub(() => {
        const g = mem.groups[gid];
        cb(g ? Object.entries(g.expenses).map(([id, e]) => ({ id, ...clone(e) })) : [], false);
      });
    },
    async saveExpense(gid, exp) {
      const { id, ...data } = exp;
      mem.groups[gid].expenses[id] = clone(data);
      save();
    },
  };
}

export async function createStore() {
  if (!window.SPLITLAH_CONFIG) {
    throw Object.assign(new Error('config.js has a typo'), { code: 'config/broken' });
  }
  const cfg = window.SPLITLAH_CONFIG?.firebase;
  if (cfg && cfg.apiKey && cfg.projectId && !String(cfg.apiKey).includes('PASTE')) {
    return firebaseStore(cfg);
  }
  return localStore();
}
