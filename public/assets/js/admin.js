/* ══════════════════════════════════════════════════════════════
   Mizanora TV — Admin Panel
   Live mode  : Firebase Auth + Firestore (server token se API calls)
   Demo mode  : localStorage (offline preview — deploy ke baghair test)
   ══════════════════════════════════════════════════════════════ */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s = '') => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 9);
  const nowSec = () => Math.floor(Date.now() / 1000);

  const LSKEY = 'mizanora_db_v1';
  const FB_VER = '10.14.1';
  const FB = { ready: false, auth: null, db: null, app: null, fns: {}, user: null, token: null };

  const S = {
    mode: 'demo',
    view: 'dashboard',
    channels: [],
    users: [],
    posts: [],
    settings: {},
    editing: null,
  };

  /* ─────────────── toast ─────────────── */
  function toast(msg, bad) {
    const t = document.createElement('div');
    t.className = 'toast' + (bad ? ' bad' : '');
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 4200);
  }

  /* ─────────────── localStorage (demo) ─────────────── */
  function lsGet() {
    try {
      return JSON.parse(localStorage.getItem(LSKEY) || 'null');
    } catch {
      return null;
    }
  }
  function lsSet(db) {
    localStorage.setItem(LSKEY, JSON.stringify(db));
  }
  function seedDemo() {
    const d = window.MIZANORA_DEMO || { channels: [], settings: {} };
    return {
      channels: d.channels.map((c) => ({ ...c, enabled: true })),
      settings: { ...d.settings, streamTokenTtl: 43200, adsEnabled: true, preRollSeconds: 5 },
      users: [
        { id: 'u1', username: 'owner', password: 'mizanora-owner', maxConnections: 3, expDate: 0, status: 'active', createdAt: nowSec() },
        { id: 'u2', username: 'trial', password: 'trial24', maxConnections: 1, expDate: nowSec() + 86400 * 7, status: 'active', createdAt: nowSec() },
      ],
      posts: [
        {
          id: 'p1',
          slug: 'fastest-m3u8',
          title: 'Fastest m3u8 source kaise chunte hain?',
          excerpt: 'TTFB, TLS handshake aur parallel probing — latency ka asal math.',
          body:
            '## Latency sirf bandwidth nahi hai\nFastest source ka matlab sabse kam **TTFB** (time to first byte).\n\n1. Har URL ko parallel probe karein\n2. 4s timeout rakhein\n3. Score = TTFB + priority penalty\n4. Result 45s cache karein\n\nIsse player ko pehla segment jaldi milta hai — buffer kam.',
          tag: 'Guide',
          author: 'Muaz Iqbal',
          createdAt: nowSec() - 86400 * 3,
          published: true,
        },
        {
          id: 'p2',
          slug: 'xtream-setup',
          title: 'Xtream Codes API: 5 minute setup',
          excerpt: 'TiviMate, Smarters aur VLC me apna Mizanora server kaise add karein.',
          body:
            '## Steps\n1. Admin panel → Xtream Users → naya user banayein\n2. Server URL: aapka Vercel domain\n3. Username / Password wahi jo banaya\n4. Login → live channels auto load\n\nM3U link bhi milta hai: `/get.php?username=..&password=..&type=m3u_plus&output=m3u8`',
          tag: 'Setup',
          author: 'Muaz Iqbal',
          createdAt: nowSec() - 86400 * 6,
          published: true,
        },
        {
          id: 'p3',
          slug: 'signed-links',
          title: 'Signed links se source chhupana',
          excerpt: 'HMAC tokens, expiry aur proxy — raw stream URLs ko browser se door rakhna.',
          body:
            '## Kyun?\nAgar raw m3u8 browser me aata hai to koi bhi share kar sakta hai.\n\n- HMAC-SHA256 signed payload\n- expiry (default 12h)\n- har segment bhi signed proxy se\n- origin server + referer hidden',
          tag: 'Security',
          author: 'Muaz Iqbal',
          createdAt: nowSec() - 86400 * 9,
          published: true,
        },
      ],
    };
  }
  async function loadDemo() {
    let db = lsGet();
    if (!db || !db.channels) {
      db = seedDemo();
      lsSet(db);
    }
    Object.assign(S, { channels: db.channels || [], settings: db.settings || {}, users: db.users || [], posts: db.posts || [] });
  }
  function persistDemo() {
    lsSet({ channels: S.channels, settings: S.settings, users: S.users, posts: S.posts });
  }

  /* ─────────────── Firebase (live) ─────────────── */
  async function initFirebase() {
    try {
      const appMod = await import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app.js`);
      const authMod = await import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-auth.js`);
      const dbMod = await import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-firestore.js`);
      FB.app = appMod.initializeApp(window.FIREBASE_CONFIG);
      FB.auth = authMod.getAuth(FB.app);
      FB.db = dbMod.getFirestore(FB.app);
      FB.fns = { ...authMod, ...dbMod };
      FB.ready = true;
      return true;
    } catch (e) {
      console.warn('[Mizanora] Firebase load fail → demo mode:', e.message);
      return false;
    }
  }

  async function fsAll(col) {
    const { collection, getDocs } = FB.fns;
    const snap = await getDocs(collection(FB.db, col));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  async function fsSet(col, id, data) {
    const { doc, setDoc } = FB.fns;
    await setDoc(doc(FB.db, col, id), data, { merge: true });
  }
  async function fsDel(col, id) {
    const { doc, deleteDoc } = FB.fns;
    await deleteDoc(doc(FB.db, col, id));
  }
  async function fsSettings() {
    const { doc, getDoc } = FB.fns;
    const snap = await getDoc(doc(FB.db, 'settings', 'site'));
    return snap.exists() ? snap.data() : {};
  }

  async function loadLive() {
    const [channels, users, posts, settings] = await Promise.all([
      fsAll('channels'),
      fsAll('xtream_users'),
      fsAll('posts'),
      fsSettings(),
    ]);
    Object.assign(S, { channels, users, posts, settings });
  }

  async function authHeader() {
    if (S.mode !== 'live' || !FB.user) return {};
    const token = await FB.user.getIdToken();
    return { Authorization: 'Bearer ' + token };
  }

  /* ─────────────── auth flow ─────────────── */
  async function boot() {
    const ok = await initFirebase();
    if (ok) {
      FB.fns.onAuthStateChanged(FB.auth, async (user) => {
        if (user) {
          FB.user = user;
          S.mode = 'live';
          try {
            await loadLive();
          } catch (e) {
            toast('Firestore read fail: ' + e.message, true);
          }
          showAdmin(user.email || user.uid);
        } else {
          $('#loginView').classList.remove('hidden');
          $('#adminView').classList.add('hidden');
        }
      });
    }
    bindLogin(ok);
  }

  function bindLogin(firebaseOk) {
    $('#loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#loginEmail').value.trim();
      const pass = $('#loginPass').value;
      $('#loginErr').textContent = '';
      if (!firebaseOk) {
        $('#loginErr').textContent = 'Firebase SDK load nahi hua (offline?). Demo mode use karein.';
        return;
      }
      try {
        await FB.fns.signInWithEmailAndPassword(FB.auth, email, pass);
      } catch (err) {
        $('#loginErr').textContent = err.message.replace('Firebase: ', '');
      }
    });

    $('#demoLogin').onclick = async () => {
      S.mode = 'demo';
      await loadDemo();
      showAdmin('demo@local');
    };

    $('#logoutBtn').onclick = async () => {
      if (S.mode === 'live' && FB.ready) {
        await FB.fns.signOut(FB.auth);
      } else {
        location.reload();
      }
    };
  }

  function showAdmin(who) {
    $('#loginView').classList.add('hidden');
    $('#adminView').classList.remove('hidden');
    $('#whoami').innerHTML = `<b>${esc(who)}</b><br><span style="font-size:.75rem;color:var(--muted)">${S.mode === 'live' ? 'Live • Firebase' : 'Demo • localStorage'}</span>`;
    $$('#sideNav button').forEach((b) => (b.onclick = () => {
      S.view = b.dataset.view;
      $$('#sideNav button').forEach((x) => x.classList.toggle('active', x === b));
      render();
    }));
    render();
  }

  /* ─────────────── persistence router ─────────────── */
  async function saveChannel(ch) {
    if (S.mode === 'live') {
      const id = ch.id || 'ch_' + uid();
      await fsSet('channels', id, { ...ch, id, updatedAt: Date.now() });
      await loadLive();
    } else {
      const id = ch.id || 'ch_' + uid();
      const i = S.channels.findIndex((c) => c.id === id);
      const next = { ...ch, id, updatedAt: Date.now() };
      if (i >= 0) S.channels[i] = next;
      else S.channels.push(next);
      persistDemo();
    }
  }
  async function deleteChannel(id) {
    if (S.mode === 'live') {
      await fsDel('channels', id);
      await loadLive();
    } else {
      S.channels = S.channels.filter((c) => c.id !== id);
      persistDemo();
    }
  }
  async function saveUser(u) {
    if (S.mode === 'live') {
      const id = u.id || 'xu_' + uid();
      await fsSet('xtream_users', id, { ...u, id, createdAt: u.createdAt || nowSec() });
      await loadLive();
    } else {
      const id = u.id || 'xu_' + uid();
      const i = S.users.findIndex((x) => x.id === id);
      const next = { ...u, id, createdAt: u.createdAt || nowSec() };
      if (i >= 0) S.users[i] = next;
      else S.users.push(next);
      persistDemo();
    }
  }
  async function deleteUser(id) {
    if (S.mode === 'live') {
      await fsDel('xtream_users', id);
      await loadLive();
    } else {
      S.users = S.users.filter((x) => x.id !== id);
      persistDemo();
    }
  }
  async function savePost(p) {
    if (S.mode === 'live') {
      const id = p.id || 'po_' + uid();
      await fsSet('posts', id, { ...p, id, createdAt: p.createdAt || nowSec() });
      await loadLive();
    } else {
      const id = p.id || 'po_' + uid();
      const i = S.posts.findIndex((x) => x.id === id);
      const next = { ...p, id, createdAt: p.createdAt || nowSec() };
      if (i >= 0) S.posts[i] = next;
      else S.posts.push(next);
      persistDemo();
    }
  }
  async function deletePost(id) {
    if (S.mode === 'live') {
      await fsDel('posts', id);
      await loadLive();
    } else {
      S.posts = S.posts.filter((x) => x.id !== id);
      persistDemo();
    }
  }
  async function saveSettings(obj) {
    S.settings = { ...S.settings, ...obj };
    if (S.mode === 'live') await fsSet('settings', 'site', obj);
    else persistDemo();
  }

  /* ─────────────── render router ─────────────── */
  function render() {
    const v = $('#view');
    const map = { dashboard: viewDashboard, channels: viewChannels, users: viewUsers, settings: viewSettings, publish: viewPublish, posts: viewPosts, system: viewSystem };
    v.innerHTML = (map[S.view] || viewDashboard)();
    bindView();
    v.scrollTop = 0;
    window.scrollTo({ top: 0 });
  }

  function head(title, sub, actions = '') {
    return `<div class="admin-head"><div><h1>${title}</h1><p>${sub}</p></div><div style="display:flex;gap:8px;flex-wrap:wrap">${actions}</div></div>`;
  }

  /* ─────────────── dashboard ─────────────── */
  function viewDashboard() {
    const enabled = S.channels.filter((c) => c.enabled !== false).length;
    const sources = S.channels.reduce((n, c) => n + (c.sources || []).length, 0);
    const activeUsers = S.users.filter((u) => u.status !== 'inactive').length;
    return `
      ${head('Dashboard', 'Mizanora TV control center — sab kuch ek jagah.', `<a class="btn btn-sm" href="/" target="_blank">Site dekhein</a>`)}
      <div class="stat-grid">
        <div class="stat-card"><b>${S.channels.length}</b><span>Channels</span></div>
        <div class="stat-card"><b>${enabled}</b><span>Enabled</span></div>
        <div class="stat-card"><b>${sources}</b><span>Servers</span></div>
        <div class="stat-card"><b>${activeUsers}</b><span>Xtream users</span></div>
        <div class="stat-card"><b>${S.posts.length}</b><span>Blog posts</span></div>
      </div>
      <div class="panel">
        <h3>Quick actions</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" data-act="new-channel">+ Naya channel</button>
          <button class="btn btn-sm" data-act="new-user">+ Xtream user</button>
          <button class="btn btn-sm" data-act="publish">🐙 master.m3u publish</button>
          <button class="btn btn-sm" data-act="copy-private">🔑 Private playlist link</button>
        </div>
      </div>
      <div class="panel">
        <h3>System status</h3>
        <table class="data">
          <tbody>
            <tr><td>Data mode</td><td><span class="tag-${S.mode === 'live' ? 'ok' : 'off'}">${S.mode === 'live' ? 'LIVE • Firebase' : 'DEMO • localStorage'}</span></td></tr>
            <tr><td>Firebase project</td><td class="mono">${esc(window.FIREBASE_CONFIG?.projectId || '—')}</td></tr>
            <tr><td>Public API</td><td class="mono">/api/channels</td></tr>
            <tr><td>Fastest engine</td><td class="mono">/api/health?id=&lt;channel&gt;</td></tr>
            <tr><td>Xtream API</td><td class="mono">/player_api.php · /get.php · /xmltv.php</td></tr>
            <tr><td>Private playlist</td><td class="mono">/m3u/&lt;PLAYLIST_TOKEN&gt;</td></tr>
          </tbody>
        </table>
      </div>
      <div class="panel">
        <h3>Owner</h3>
        <p class="hint" style="margin:0">Mizanora TV — designed &amp; developed by <b>Muaz Iqbal</b>, Kasur, Pakistan.<br>
        Firebase project: <b>mizanora-tv-001</b> · Hosting: Vercel · Master playlist: GitHub.</p>
      </div>`;
  }

  /* ─────────────── channels ─────────────── */
  function viewChannels() {
    const rows = S.channels
      .slice()
      .sort((a, b) => (a.number || 999) - (b.number || 999))
      .map(
        (c) => `<tr>
          <td><b>${esc(c.name)}</b><br><span class="hint mono">${esc(c.id)}</span></td>
          <td>${esc(c.category || 'General')}</td>
          <td>${esc(String(c.number || ''))}</td>
          <td>${(c.sources || []).length}</td>
          <td>${c.enabled === false ? '<span class="tag-off">Disabled</span>' : '<span class="tag-ok">Enabled</span>'}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-sm" data-edit="${esc(c.id)}">Edit</button>
            <button class="btn btn-sm" data-test="${esc(c.id)}">Test</button>
            <button class="btn btn-sm btn-danger" data-del="${esc(c.id)}">Del</button>
          </td>
        </tr>`
      )
      .join('');

    return `
      ${head('Channels', 'Har channel ke multiple m3u8 servers — engine fastest chunta hai.', `<button class="btn btn-primary btn-sm" data-act="new-channel">+ Naya channel</button>`)}
      ${S.editing ? channelForm(S.editing) : ''}
      <div class="panel">
        <table class="data">
          <thead><tr><th>Channel</th><th>Category</th><th>#</th><th>Src</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="6" class="hint">Koi channel nahi. “+ Naya channel” dabayein.</td></tr>`}</tbody>
        </table>
      </div>
      <div class="panel">
        <h3>Bulk import (JSON)</h3>
        <p class="hint">Format: <code>[{"name":"Channel","category":"News","sources":["https://...m3u8","https://...m3u8"]}]</code></p>
        <textarea id="bulkJson" rows="5" placeholder='[{"name":"My Channel","category":"News","sources":["https://a/list.m3u8","https://b/list.m3u8"]}]'></textarea>
        <div style="margin-top:10px"><button class="btn btn-sm" data-act="bulk-import">Import channels</button></div>
      </div>`;
  }

  function channelForm(c) {
    const srcs = (c.sources && c.sources.length ? c.sources : [{ label: 'Server 1', url: '' }]);
    return `
      <div class="panel" id="channelForm">
        <h3>${c.id ? 'Edit' : 'Naya'} channel</h3>
        <div class="form-grid">
          <div class="field"><label>Name *</label><input id="f_name" value="${esc(c.name || '')}" placeholder="Mizanora One"></div>
          <div class="field"><label>Category</label><input id="f_category" value="${esc(c.category || 'General')}" placeholder="News / Sports / Movies"></div>
          <div class="field"><label>Channel number</label><input id="f_number" type="number" value="${esc(c.number || '')}" placeholder="1"></div>
          <div class="field"><label>EPG ID</label><input id="f_epg" value="${esc(c.epg || '')}" placeholder="mizanora-one"></div>
          <div class="field"><label>Logo URL</label><input id="f_logo" value="${esc(c.logo || '')}" placeholder="https://.../logo.png"></div>
          <div class="field"><label>Quality</label><input id="f_quality" value="${esc(c.quality || '')}" placeholder="FHD / HD / SD"></div>
          <div class="field"><label>Language</label><input id="f_language" value="${esc(c.language || '')}" placeholder="Urdu / English"></div>
          <div class="field"><label>Featured</label><select id="f_featured"><option value="0">No</option><option value="1" ${c.featured ? 'selected' : ''}>Yes</option></select></div>
          <div class="field"><label>Status</label><select id="f_enabled"><option value="1">Enabled</option><option value="0" ${c.enabled === false ? 'selected' : ''}>Disabled</option></select></div>
          <div class="field full"><label>Description</label><textarea id="f_description" rows="2">${esc(c.description || '')}</textarea></div>
        </div>

        <h3 style="margin-top:18px">m3u8 Servers (fastest automatically select hoga)</h3>
        <div id="sourceRows">
          ${srcs
            .map(
              (s, i) => `<div class="source-row">
                <input class="src-label" placeholder="Label (Server ${i + 1})" value="${esc(s.label || '')}">
                <input class="src-url" placeholder="https://example.com/live/index.m3u8" value="${esc(s.url || s.link || '')}">
                <button class="btn btn-sm btn-danger" data-rm-src="${i}">✕</button>
              </div>`
            )
            .join('')}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          <button class="btn btn-sm" data-act="add-src">+ Server row</button>
          <button class="btn btn-sm" data-act="probe-draft">⚡ Probe all servers</button>
        </div>
        <div id="probeOut" class="hint mono" style="margin-top:10px;white-space:pre-wrap"></div>

        <div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" data-act="save-channel">💾 Save channel</button>
          <button class="btn btn-sm" data-act="cancel-channel">Cancel</button>
        </div>
      </div>`;
  }

  function readChannelForm() {
    const srcs = $$('#sourceRows .source-row').map((row, i) => ({
      label: $('.src-label', row).value.trim() || `Server ${i + 1}`,
      url: $('.src-url', row).value.trim(),
      priority: i,
      enabled: true,
    })).filter((s) => s.url);
    return {
      id: S.editing?.id,
      name: $('#f_name').value.trim(),
      category: $('#f_category').value.trim() || 'General',
      number: Number($('#f_number').value) || 0,
      epg: $('#f_epg').value.trim(),
      logo: $('#f_logo').value.trim(),
      quality: $('#f_quality').value.trim(),
      language: $('#f_language').value.trim(),
      featured: $('#f_featured').value === '1',
      enabled: $('#f_enabled').value === '1',
      description: $('#f_description').value.trim(),
      sources: srcs,
      createdAt: S.editing?.createdAt || Date.now(),
    };
  }

  /* ─────────────── users ─────────────── */
  function origin() {
    return location.origin;
  }
  function viewUsers() {
    const rows = S.users
      .map((u) => {
        const exp = Number(u.expDate || 0);
        const expTxt = exp ? new Date(exp * 1000).toLocaleDateString() : 'Unlimited';
        const m3u = `${origin()}/get.php?username=${encodeURIComponent(u.username)}&password=${encodeURIComponent(u.password)}&type=m3u_plus&output=m3u8`;
        return `<tr>
          <td><b>${esc(u.username)}</b><br><span class="hint mono">${esc(u.password)}</span></td>
          <td>${esc(String(u.maxConnections || 1))}</td>
          <td>${esc(expTxt)}</td>
          <td>${u.status === 'inactive' ? '<span class="tag-off">Inactive</span>' : '<span class="tag-ok">Active</span>'}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-sm" data-copy="${esc(m3u)}">Copy M3U</button>
            <button class="btn btn-sm" data-edit-user="${esc(u.id)}">Edit</button>
            <button class="btn btn-sm btn-danger" data-del-user="${esc(u.id)}">Del</button>
          </td>
        </tr>`;
      })
      .join('');

    const e = S.editingUser || {};
    return `
      ${head('Xtream Users', 'In users se hi Xtream Codes / M3U login hota hai. Sirf aap inhe share karein.', '')}
      <div class="panel">
        <h3>${e.id ? 'Edit user' : 'Naya user'}</h3>
        <div class="form-grid">
          <div class="field"><label>Username *</label><input id="u_username" value="${esc(e.username || '')}" placeholder="customer1"></div>
          <div class="field"><label>Password *</label><input id="u_password" value="${esc(e.password || '')}" placeholder="strong-password"></div>
          <div class="field"><label>Max connections</label><input id="u_max" type="number" value="${esc(e.maxConnections || 1)}"></div>
          <div class="field"><label>Expiry date</label><input id="u_exp" type="date" value="${e.expDate ? new Date(e.expDate * 1000).toISOString().slice(0, 10) : ''}"></div>
          <div class="field"><label>Status</label><select id="u_status"><option value="active">Active</option><option value="inactive" ${e.status === 'inactive' ? 'selected' : ''}>Inactive</option></select></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" data-act="save-user">💾 Save user</button>
          ${e.id ? '<button class="btn btn-sm" data-act="cancel-user">Cancel</button>' : ''}
        </div>
      </div>
      <div class="panel">
        <table class="data">
          <thead><tr><th>Credentials</th><th>Conns</th><th>Expiry</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="5" class="hint">Koi user nahi.</td></tr>`}</tbody>
        </table>
      </div>
      <div class="panel">
        <h3>Connect info (players ke liye)</h3>
        <div class="form-grid">
          <div class="field"><label>Xtream server URL</label><input readonly value="${esc(origin())}"></div>
          <div class="field"><label>Port</label><input readonly value="443"></div>
          <div class="field full"><label>M3U URL (username/password replace karein)</label><input readonly value="${esc(origin())}/get.php?username=USER&password=PASS&type=m3u_plus&output=m3u8"></div>
        </div>
      </div>`;
  }

  /* ─────────────── settings ─────────────── */
  function viewSettings() {
    const s = S.settings || {};
    const ads = s.ads || {};
    return `
      ${head('Settings', 'Site branding, ads aur stream token expiry.', '')}
      <div class="panel">
        <h3>Branding</h3>
        <div class="form-grid">
          <div class="field"><label>Site name</label><input id="s_siteName" value="${esc(s.siteName || 'Mizanora TV')}"></div>
          <div class="field"><label>Tagline</label><input id="s_tagline" value="${esc(s.tagline || 'Fastest Streaming Engine')}"></div>
          <div class="field"><label>Accent color</label><input id="s_accent" type="color" value="${esc(s.accent || '#22d3ee')}"></div>
          <div class="field"><label>Logo URL</label><input id="s_logo" value="${esc(s.logo || '/assets/img/logo.svg')}"></div>
          <div class="field"><label>Contact email</label><input id="s_email" value="${esc(s.email || '')}"></div>
          <div class="field"><label>Telegram</label><input id="s_telegram" value="${esc(s.telegram || '')}" placeholder="https://t.me/..."></div>
          <div class="field"><label>WhatsApp</label><input id="s_whatsapp" value="${esc(s.whatsapp || '')}"></div>
          <div class="field"><label>Stream token TTL (seconds)</label><input id="s_ttl" type="number" value="${esc(s.streamTokenTtl || 43200)}"></div>
          <div class="field full"><label>About text</label><textarea id="s_about" rows="3">${esc(s.aboutText || '')}</textarea></div>
        </div>
      </div>
      <div class="panel">
        <h3>Advertisements (pre-roll)</h3>
        <div class="form-grid">
          <div class="field"><label>Pre-roll enabled</label><select id="s_adsEnabled"><option value="0">Off</option><option value="1" ${(s.adsEnabled ?? ads.enabled) ? 'selected' : ''}>On</option></select></div>
          <div class="field"><label>Pre-roll seconds</label><input id="s_preRollSeconds" type="number" value="${esc(s.preRollSeconds ?? ads.preRollSeconds ?? 5)}"></div>
          <div class="field"><label>Pre-roll image URL</label><input id="s_preRollImage" value="${esc(s.preRollImage || '')}"></div>
          <div class="field"><label>Pre-roll link</label><input id="s_preRollLink" value="${esc(s.preRollLink || '')}"></div>
          <div class="field"><label>Banner image URL</label><input id="s_adBanner" value="${esc(s.adBanner || '')}"></div>
          <div class="field"><label>Banner link</label><input id="s_adBannerLink" value="${esc(s.adBannerLink || '')}"></div>
        </div>
        <div style="margin-top:14px"><button class="btn btn-primary btn-sm" data-act="save-settings">💾 Save settings</button></div>
      </div>`;
  }

  /* ─────────────── publish ─────────────── */
  function viewPublish() {
    return `
      ${head('GitHub Publish', 'master.m3u ko GitHub repo me commit karta hai — token server par rehta hai.', '')}
      <div class="panel">
        <h3>Publish master.m3u</h3>
        <p class="hint">Vercel env me <code>GITHUB_TOKEN</code>, <code>GITHUB_REPO</code>, <code>GITHUB_BRANCH</code>, <code>GITHUB_PATH</code> set hone chahiye.</p>
        <div class="field"><label>Commit message</label><input id="p_msg" value="chore(playlist): update master.m3u"></div>
        <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" data-act="publish">🐙 Publish now</button>
          <button class="btn btn-sm" data-act="preview-playlist">👁 Playlist preview</button>
        </div>
        <pre id="publishOut" class="mono" style="margin-top:14px;background:#080d16;border:1px solid var(--line);border-radius:12px;padding:12px;font-size:.78rem;overflow:auto;max-height:320px">Ready.</pre>
      </div>
      <div class="panel">
        <h3>Master playlist format</h3>
        <p class="hint">Har channel multiple sources ke sath; GitHub file me sirf signed /s/&lt;token&gt; links jate hain (raw m3u8 nahi).</p>
        <pre class="mono" style="background:#080d16;border:1px solid var(--line);border-radius:12px;padding:12px;font-size:.78rem;overflow:auto">#EXTM3U
#EXTINF:-1 tvg-id="mizanora-one" tvg-name="Mizanora One" tvg-logo="..." group-title="Entertainment",Mizanora One
https://your-domain.vercel.app/s/&lt;signed-token&gt;/index.m3u8</pre>
      </div>`;
  }

  /* ─────────────── posts ─────────────── */
  function viewPosts() {
    const e = S.editingPost || {};
    const rows = S.posts
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .map(
        (p) => `<tr>
          <td><b>${esc(p.title)}</b><br><span class="hint mono">${esc(p.slug || p.id)}</span></td>
          <td>${esc(p.tag || 'Guide')}</td>
          <td>${p.published === false ? '<span class="tag-off">Draft</span>' : '<span class="tag-ok">Live</span>'}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-sm" data-edit-post="${esc(p.id)}">Edit</button>
            <button class="btn btn-sm btn-danger" data-del-post="${esc(p.id)}">Del</button>
          </td>
        </tr>`
      )
      .join('');

    return `
      ${head('Blog Posts', 'Blog aur SEO content — public /blog.html par dikhta hai.', '')}
      <div class="panel">
        <h3>${e.id ? 'Edit post' : 'Naya post'}</h3>
        <div class="form-grid">
          <div class="field"><label>Title *</label><input id="po_title" value="${esc(e.title || '')}"></div>
          <div class="field"><label>Slug</label><input id="po_slug" value="${esc(e.slug || '')}" placeholder="fastest-m3u8"></div>
          <div class="field"><label>Tag</label><input id="po_tag" value="${esc(e.tag || 'Guide')}"></div>
          <div class="field"><label>Published</label><select id="po_pub"><option value="1">Live</option><option value="0" ${e.published === false ? 'selected' : ''}>Draft</option></select></div>
          <div class="field full"><label>Excerpt</label><input id="po_excerpt" value="${esc(e.excerpt || '')}"></div>
          <div class="field full"><label>Body (markdown-lite: ## heading, - list, **bold**)</label><textarea id="po_body" rows="9">${esc(e.body || '')}</textarea></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" data-act="save-post">💾 Save post</button>
          ${e.id ? '<button class="btn btn-sm" data-act="cancel-post">Cancel</button>' : ''}
        </div>
      </div>
      <div class="panel">
        <table class="data">
          <thead><tr><th>Title</th><th>Tag</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="4" class="hint">Koi post nahi.</td></tr>`}</tbody>
        </table>
      </div>`;
  }

  /* ─────────────── system ─────────────── */
  function viewSystem() {
    const ep = [
      ['GET', '/api/channels', 'Public channel list (signed links)'],
      ['GET', '/api/health?id=<channel>', 'Fastest server ranking (live latency)'],
      ['GET', '/s/<token>/index.m3u8', 'Signed manifest (hidden origin)'],
      ['GET', '/p/<token>', 'Signed segment/key proxy'],
      ['GET', '/api/playlist?token=<PLAYLIST_TOKEN>', 'Owner private playlist'],
      ['GET', '/player_api.php?username=..&password=..', 'Xtream Codes API'],
      ['GET', '/get.php?username=..&password=..&output=m3u8', 'Xtream M3U'],
      ['GET', '/xmltv.php?username=..&password=..', 'EPG XMLTV'],
      ['POST', '/api/github/publish', 'master.m3u → GitHub (admin only)'],
      ['GET', '/api/admin/playlist', 'Private playlist (admin only)'],
    ];
    return `
      ${head('System / API', 'Endpoints, env checklist aur health.', `<button class="btn btn-sm" data-act="copy-private">🔑 Private link</button>`)}
      <div class="panel">
        <h3>Endpoints</h3>
        <table class="data">
          <thead><tr><th>Method</th><th>Path</th><th>Kaam</th><th></th></tr></thead>
          <tbody>
            ${ep
              .map(
                ([m, p, d]) => `<tr><td><span class="tag-ok">${m}</span></td><td class="mono" style="font-size:.8rem">${esc(p)}</td><td class="hint">${esc(d)}</td>
                <td><button class="btn btn-sm" data-copy="${esc(location.origin + p.replace('&', '&'))}">Copy</button></td></tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
      <div class="panel">
        <h3>Vercel env checklist</h3>
        <table class="data">
          <tbody>
            <tr><td class="mono">FIREBASE_SERVICE_ACCOUNT</td><td class="hint">Firebase Admin key JSON (single line)</td></tr>
            <tr><td class="mono">PUBLIC_BASE_URL</td><td class="hint">https://your-domain.vercel.app</td></tr>
            <tr><td class="mono">PLAYLIST_TOKEN</td><td class="hint">Private playlist ka secret</td></tr>
            <tr><td class="mono">GITHUB_TOKEN / GITHUB_REPO</td><td class="hint">master.m3u publish ke liye</td></tr>
            <tr><td class="mono">STREAM_PROXY_SECRET</td><td class="hint">Signed links ka HMAC secret (optional)</td></tr>
          </tbody>
        </table>
      </div>
      <div class="panel">
        <h3>Health test</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-sm" data-act="health">/api/channels test</button>
        </div>
        <pre id="healthOut" class="mono" style="margin-top:12px;background:#080d16;border:1px solid var(--line);border-radius:12px;padding:12px;font-size:.78rem;overflow:auto;max-height:280px">—</pre>
      </div>`;
  }

  /* ─────────────── events ─────────────── */
  function bindView() {
    document.onclick = null;
    $('#view').onclick = async (e) => {
      const el = e.target.closest('button, [data-edit], [data-del]');
      if (!el) return;
      const act = el.dataset.act;
      const copy = el.dataset.copy;
      if (copy) return navigator.clipboard.writeText(copy).then(() => toast('Copied!'));

      if (el.dataset.edit) {
        S.editing = S.channels.find((c) => c.id === el.dataset.edit);
        render();
        return;
      }
      if (el.dataset.del) {
        if (!confirm('Channel delete karna hai?')) return;
        await deleteChannel(el.dataset.del);
        toast('Channel delete ho gaya');
        return render();
      }
      if (el.dataset.test) {
        const ch = S.channels.find((c) => c.id === el.dataset.test);
        toast('Probing ' + ch.name + ' …');
        const ranked = await probeChannel(ch);
        toast(`${ch.name}: ` + (ranked.find((r) => r.ok)?.label || 'koi alive server nahi') + ' fastest');
        return;
      }
      if (el.dataset.editUser) {
        S.editingUser = S.users.find((u) => u.id === el.dataset.editUser);
        return render();
      }
      if (el.dataset.delUser) {
        if (!confirm('User delete karna hai?')) return;
        await deleteUser(el.dataset.delUser);
        toast('User delete');
        return render();
      }
      if (el.dataset.editPost) {
        S.editingPost = S.posts.find((p) => p.id === el.dataset.editPost);
        return render();
      }
      if (el.dataset.delPost) {
        if (!confirm('Post delete?')) return;
        await deletePost(el.dataset.delPost);
        toast('Post delete');
        return render();
      }
      if (el.dataset.rmSrc !== undefined) {
        el.closest('.source-row').remove();
        return;
      }

      switch (act) {
        case 'new-channel':
          S.view = 'channels';
          S.editing = { sources: [{ label: 'Server 1', url: '' }] };
          $$('#sideNav button').forEach((b) => b.classList.toggle('active', b.dataset.view === 'channels'));
          return render();
        case 'cancel-channel':
          S.editing = null;
          return render();
        case 'add-src': {
          const rows = $('#sourceRows');
          const i = rows.children.length;
          const div = document.createElement('div');
          div.className = 'source-row';
          div.innerHTML = `<input class="src-label" placeholder="Label (Server ${i + 1})"><input class="src-url" placeholder="https://example.com/live/index.m3u8"><button class="btn btn-sm btn-danger" data-rm-src="${i}">✕</button>`;
          rows.appendChild(div);
          return;
        }
        case 'probe-draft': {
          const draft = { sources: $$('#sourceRows .source-row').map((r, i) => ({ label: $('.src-label', r).value || `Server ${i + 1}`, url: $('.src-url', r).value })).filter((s) => s.url) };
          if (!draft.sources.length) return toast('Pehle koi m3u8 URL daalein', true);
          $('#probeOut').textContent = 'Probing…';
          const ranked = await probeChannel(draft);
          const fastest = ranked.findIndex((r) => r.ok);
          $('#probeOut').textContent = ranked
            .map((r, i) => `${i + 1}. ${r.label.padEnd(14)} ${r.ok ? r.ms + ' ms' + (i === fastest ? '  ✔ fastest' : '') : 'offline ✖'}`)
            .join('\n');
          return;
        }
        case 'save-channel': {
          const ch = readChannelForm();
          if (!ch.name) return toast('Name zaroori hai', true);
          if (!ch.sources.length) return toast('Kam az kam ek m3u8 URL daalein', true);
          await saveChannel(ch);
          S.editing = null;
          toast('Channel save ho gaya');
          return render();
        }
        case 'bulk-import': {
          try {
            const arr = JSON.parse($('#bulkJson').value);
            if (!Array.isArray(arr)) throw new Error('Array expected');
            let n = 0;
            for (const item of arr) {
              await saveChannel({
                name: item.name,
                category: item.category || 'General',
                number: item.number || 0,
                logo: item.logo || '',
                epg: item.epg || '',
                enabled: true,
                sources: (item.sources || []).map((u, i) => ({ label: `Server ${i + 1}`, url: typeof u === 'string' ? u : u.url, priority: i, enabled: true })),
                createdAt: Date.now(),
              });
              n++;
            }
            toast(n + ' channels import ho gaye');
            return render();
          } catch (err) {
            return toast('JSON error: ' + err.message, true);
          }
        }
        case 'save-user': {
          const username = $('#u_username').value.trim();
          const password = $('#u_password').value.trim();
          if (!username || !password) return toast('Username & password zaroori', true);
          const expVal = $('#u_exp').value;
          await saveUser({
            id: S.editingUser?.id,
            username,
            password,
            maxConnections: Number($('#u_max').value) || 1,
            expDate: expVal ? Math.floor(new Date(expVal + 'T23:59:59').getTime() / 1000) : 0,
            status: $('#u_status').value,
            createdAt: S.editingUser?.createdAt,
          });
          S.editingUser = null;
          toast('User save ho gaya');
          return render();
        }
        case 'cancel-user':
          S.editingUser = null;
          return render();
        case 'save-settings': {
          const obj = {
            siteName: $('#s_siteName').value,
            tagline: $('#s_tagline').value,
            accent: $('#s_accent').value,
            logo: $('#s_logo').value,
            email: $('#s_email').value,
            telegram: $('#s_telegram').value,
            whatsapp: $('#s_whatsapp').value,
            streamTokenTtl: Number($('#s_ttl').value) || 43200,
            aboutText: $('#s_about').value,
            adsEnabled: $('#s_adsEnabled').value === '1',
            preRollSeconds: Number($('#s_preRollSeconds').value) || 0,
            preRollImage: $('#s_preRollImage').value,
            preRollLink: $('#s_preRollLink').value,
            adBanner: $('#s_adBanner').value,
            adBannerLink: $('#s_adBannerLink').value,
          };
          await saveSettings(obj);
          toast('Settings save ho gayi');
          return;
        }
        case 'save-post': {
          const title = $('#po_title').value.trim();
          if (!title) return toast('Title zaroori', true);
          await savePost({
            id: S.editingPost?.id,
            title,
            slug: ($('#po_slug').value.trim() || title.toLowerCase().replace(/[^a-z0-9]+/g, '-')).replace(/^-|-$/g, ''),
            tag: $('#po_tag').value.trim() || 'Guide',
            excerpt: $('#po_excerpt').value.trim(),
            body: $('#po_body').value,
            published: $('#po_pub').value === '1',
            author: 'Muaz Iqbal',
            createdAt: S.editingPost?.createdAt,
          });
          S.editingPost = null;
          toast('Post save ho gaya');
          return render();
        }
        case 'cancel-post':
          S.editingPost = null;
          return render();
        case 'save-settings-done':
          return;
        case 'publish': {
          const out = $('#publishOut');
          if (S.mode === 'demo') {
            out.textContent = '⚠ Demo mode: publish ke liye deploy + Firebase login zaroori hai.\n\nSteps:\n1. Vercel par deploy karein\n2. Env me GITHUB_TOKEN + GITHUB_REPO set karein\n3. Admin panel Firebase login se kholein\n4. Publish now dabayein';
            return;
          }
          out.textContent = 'Publishing…';
          try {
            const r = await fetch('/api/github/publish', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
              body: JSON.stringify({ message: $('#p_msg')?.value || 'update master.m3u' }),
            });
            const j = await r.json();
            out.textContent = JSON.stringify(j, null, 2);
            toast(j.ok ? 'master.m3u publish ho gaya 🎉' : 'Publish fail — output dekhein', !j.ok);
          } catch (err) {
            out.textContent = 'Error: ' + err.message;
          }
          return;
        }
        case 'preview-playlist': {
          const out = $('#publishOut');
          if (S.mode === 'demo') {
            out.textContent = '#EXTM3U\n' + S.channels.map((c) => `#EXTINF:-1 tvg-name="${c.name}" group-title="${c.category}",${c.name}\n(server-side signed link on deploy)`).join('\n');
            return;
          }
          out.textContent = 'Loading…';
          try {
            const r = await fetch('/api/admin/playlist', { headers: await authHeader() });
            const j = await r.json();
            out.textContent = j.playlist || JSON.stringify(j, null, 2);
          } catch (err) {
            out.textContent = 'Error: ' + err.message;
          }
          return;
        }
        case 'copy-private': {
          if (S.mode === 'demo') return toast('Demo mode: deploy ke baad /m3u/<PLAYLIST_TOKEN> milega', true);
          try {
            const r = await fetch('/api/admin/playlist', { headers: await authHeader() });
            const j = await r.json();
            if (j.privateUrl) {
              await navigator.clipboard.writeText(j.privateUrl);
              toast('Private playlist link copied 🔑');
            } else toast('PLAYLIST_TOKEN env set nahi hai', true);
          } catch (err) {
            toast('Error: ' + err.message, true);
          }
          return;
        }
        case 'health': {
          const out = $('#healthOut');
          out.textContent = 'Testing…';
          try {
            const r = await fetch('/api/channels');
            const j = await r.json();
            out.textContent = JSON.stringify({ status: r.status, ok: j.ok, mode: j.mode, total: j.total, error: j.error, detail: j.detail }, null, 2);
          } catch (err) {
            out.textContent = 'API reachable nahi (offline preview). Deploy ke baad chalega.\n' + err.message;
          }
          return;
        }
        default:
          return;
      }
    };
  }

  async function probeChannel(ch) {
    if (S.mode === 'live') {
      try {
        const r = await fetch('/api/health?id=' + encodeURIComponent(ch.id));
        const j = await r.json();
        if (j.ok) return j.servers.map((s) => ({ label: s.label, ms: s.ms, ok: s.alive }));
      } catch {}
    }
    const srcs = (ch.sources || []).filter((s) => s.url);
    const res = await Promise.all(
      srcs.map(async (s, i) => {
        const t0 = performance.now();
        try {
          const ctl = new AbortController();
          const tm = setTimeout(() => ctl.abort(), 4000);
          const r = await fetch(s.url, { signal: ctl.signal, cache: 'no-store' });
          clearTimeout(tm);
          return { label: s.label || `Server ${i + 1}`, ms: Math.round(performance.now() - t0), ok: r.ok };
        } catch {
          return { label: s.label || `Server ${i + 1}`, ms: 0, ok: false };
        }
      })
    );
    return res.sort((a, b) => (a.ok === b.ok ? a.ms - b.ms : a.ok ? -1 : 1));
  }

  let booted = false;
  function safeBoot() {
    if (booted) return;
    booted = true;
    boot();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeBoot);
  else safeBoot();
})();
