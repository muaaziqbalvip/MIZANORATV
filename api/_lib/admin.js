/**
 * Mizanora TV — Firebase Admin (server side)
 * Firestore se channels / settings / xtream users read-write.
 * Env: FIREBASE_SERVICE_ACCOUNT (JSON string)
 */
let admin = null;
let db = null;
let initError = null;

function loadAdmin() {
  if (admin) return admin;
  try {
    // eslint-disable-next-line global-require
    admin = require('firebase-admin');
    if (!admin.apps.length) {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT missing');
      const creds = JSON.parse(raw);
      if (typeof creds.private_key === 'string') {
        creds.private_key = creds.private_key.replace(/\\n/g, '\n');
      }
      admin.initializeApp({
        credential: admin.credential.cert(creds),
        projectId: creds.project_id || process.env.FIREBASE_PROJECT_ID,
      });
    }
    db = admin.firestore();
    db.settings({ ignoreUndefinedProperties: true });
    return admin;
  } catch (e) {
    initError = e;
    return null;
  }
}

function getDb() {
  loadAdmin();
  return db;
}

function isReady() {
  return !!getDb();
}

function errMessage() {
  return initError ? String(initError.message || initError) : 'Firebase Admin not configured';
}

/* ─────────────────────────── helpers ─────────────────────────── */

async function getSettings() {
  const d = getDb();
  if (!d) return {};
  try {
    const snap = await d.collection('settings').doc('site').get();
    return snap.exists ? snap.data() : {};
  } catch {
    return {};
  }
}

async function getChannels({ onlyEnabled = true } = {}) {
  const d = getDb();
  if (!d) return [];
  const snap = await d.collection('channels').get();
  const out = [];
  snap.forEach((doc) => {
    const c = { id: doc.id, ...doc.data() };
    if (!onlyEnabled || c.enabled !== false) out.push(c);
  });
  out.sort((a, b) => (a.number || 9999) - (b.number || 9999) || String(a.name).localeCompare(String(b.name)));
  return out;
}

async function getChannel(id) {
  const d = getDb();
  if (!d) return null;
  const snap = await d.collection('channels').doc(String(id)).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function getPosts() {
  const d = getDb();
  if (!d) return [];
  const snap = await d.collection('posts').get();
  const out = [];
  snap.forEach((doc) => out.push({ id: doc.id, ...doc.data() }));
  return out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/** Xtream users collection */
async function getXtreamUser(username, password) {
  const d = getDb();
  if (!d) return null;
  const snap = await d.collection('xtream_users').where('username', '==', String(username || '')).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const u = { id: doc.id, ...doc.data() };
  if (u.password && u.password !== password) return null;
  if (u.status && String(u.status).toLowerCase() !== 'active') return null;
  if (u.expDate && Number(u.expDate) > 0 && Date.now() / 1000 > Number(u.expDate)) return null;
  return u;
}

/** Admin auth verify — Bearer <firebaseIDToken> */
async function verifyAdmin(req) {
  const a = loadAdmin();
  if (!a) return { ok: false, code: 503, error: 'server-not-configured: ' + errMessage() };
  const header = req.headers.authorization || req.headers.Authorization || '';
  const token = String(header).replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false, code: 401, error: 'missing-token' };
  try {
    const decoded = await a.auth().verifyIdToken(token);
    const ok = await isAdminUid(decoded.uid);
    if (!ok) return { ok: false, code: 403, error: 'not-admin' };
    return { ok: true, uid: decoded.uid, email: decoded.email, decoded };
  } catch (e) {
    return { ok: false, code: 401, error: 'invalid-token: ' + (e.message || e) };
  }
}

async function isAdminUid(uid) {
  const d = getDb();
  if (!d) return false;
  const snap = await d.collection('admins').doc(uid).get();
  if (snap.exists) return true;
  // bootstrap: agar admins collection bilkul khali hai to first logged-in user admin ban jaye
  const all = await d.collection('admins').limit(1).get();
  if (all.empty) {
    await d.collection('admins').doc(uid).set({ bootstrappedAt: Date.now(), role: 'owner' }, { merge: true });
    return true;
  }
  return false;
}

module.exports = {
  loadAdmin,
  getDb,
  isReady,
  errMessage,
  getSettings,
  getChannels,
  getChannel,
  getPosts,
  getXtreamUser,
  verifyAdmin,
  isAdminUid,
};
