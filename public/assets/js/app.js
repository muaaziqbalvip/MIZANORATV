/* ══════════════════════════════════════════════════════════════
   Mizanora TV — Public app (home, search, player)
   ══════════════════════════════════════════════════════════════ */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const state = { category: 'All', q: '', channels: [], settings: {}, mode: 'demo' };
  let hlsLib = null;

  /* ───────────── hls.js lazy loader (CDN, graceful fallback) ───────────── */
  function loadHls() {
    if (hlsLib) return Promise.resolve(hlsLib);
    if (window.Hls) return Promise.resolve((hlsLib = window.Hls));
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
      s.onload = () => resolve((hlsLib = window.Hls || null));
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
  }

  /* ───────────── boot ───────────── */
  async function boot() {
    const data = await window.MizanoraStore.init();
    state.mode = data.mode;
    state.settings = data.settings || {};
    state.channels = data.channels || [];

    applyBranding();
    renderStats();
    renderCategories();
    renderChannels();
    renderFeatured();
    renderEnginePreview();
    bindToolbar();

    const badge = $('#modeBadge');
    if (badge) {
      badge.textContent = state.mode === 'live' ? 'Live • Firebase' : 'Demo mode';
      badge.className = 'badge-mode ' + (state.mode === 'live' ? 'live' : 'demo');
    }

    const hash = location.hash.match(/ch=([^&]+)/);
    if (hash) openPlayer(decodeURIComponent(hash[1]));
  }

  function applyBranding() {
    const s = state.settings;
    if (s.siteName) document.title = `${s.siteName} — ${s.tagline || 'Live TV'} `;
    $$('[data-site-name]').forEach((el) => (el.textContent = s.siteName || 'Mizanora TV'));
    $$('[data-tagline]').forEach((el) => (el.textContent = s.tagline || 'Fastest Streaming Engine'));
    $$('[data-email]').forEach((el) => {
      el.textContent = s.email || 'contact@mizanora.tv';
      el.href = 'mailto:' + (s.email || 'contact@mizanora.tv');
    });
    if (s.telegram) $$('[data-telegram]').forEach((el) => { el.href = s.telegram; el.classList.remove('hidden'); });
    if (s.whatsapp) $$('[data-whatsapp]').forEach((el) => { el.href = s.whatsapp; el.classList.remove('hidden'); });
    const about = $('#aboutText');
    if (about && s.aboutText) about.textContent = s.aboutText;
  }

  function renderStats() {
    const total = state.channels.length;
    const sources = state.channels.reduce((n, c) => n + (c.sourceCount || (c.sources || []).length || 0), 0);
    const cats = new Set(state.channels.map((c) => c.category)).size;
    const map = { statChannels: total, statSources: sources, statCats: cats, statUptime: '99.9%' };
    Object.entries(map).forEach(([id, v]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    });
  }

  function renderCategories() {
    const wrap = $('#categoryChips');
    if (!wrap) return;
    const cats = ['All', ...new Set(state.channels.map((c) => c.category || 'General'))];
    wrap.innerHTML = cats
      .map((c) => `<button class="chip ${c === state.category ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`)
      .join('');
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]');
      if (!b) return;
      state.category = b.dataset.cat;
      $$('.chip', wrap).forEach((c) => c.classList.toggle('active', c === b));
      renderChannels();
    });
  }

  function filtered() {
    const q = state.q.toLowerCase().trim();
    return state.channels.filter(
      (c) =>
        (state.category === 'All' || c.category === state.category) &&
        (!q || c.name.toLowerCase().includes(q) || (c.category || '').toLowerCase().includes(q))
    );
  }

  function card(c) {
    const srcCount = c.sourceCount || (c.sources || []).length || 0;
    return `<button class="channel-card" data-id="${esc(c.id)}" title="${esc(c.name)}">
      <div class="channel-logo-wrap">
        <span class="channel-badge live">LIVE</span>
        <span class="channel-num">${esc(String(c.number || ''))}</span>
        ${c.logo ? `<img src="${esc(c.logo)}" alt="${esc(c.name)}" loading="lazy">` : `<b>${esc(c.name)}</b>`}
        <span class="channel-play">
          <span class="play-circle">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#04121a"><path d="M8 5v14l11-7z"/></svg>
          </span>
        </span>
      </div>
      <div class="channel-meta">
        <b>${esc(c.name)}</b>
        <span>${esc(c.category || 'General')} · <i class="src-count">${srcCount} src</i></span>
      </div>
    </button>`;
  }

  function renderChannels() {
    const grid = $('#channelGrid');
    if (!grid) return;
    const list = filtered();
    grid.innerHTML = list.length
      ? list.map(card).join('')
      : `<p class="hint">Koi channel nahi mila. Search clear karein ya category badlein.</p>`;
    const count = $('#resultCount');
    if (count) count.textContent = `${list.length} channel${list.length === 1 ? '' : 's'}`;
  }

  function renderFeatured() {
    const grid = $('#featuredGrid');
    if (!grid) return;
    const feat = state.channels.filter((c) => c.featured).slice(0, 4);
    grid.innerHTML = (feat.length ? feat : state.channels.slice(0, 4)).map(card).join('');
  }

  function renderEnginePreview() {
    const box = $('#enginePreview');
    if (!box) return;
    const rows = [
      ['DNS + TLS prefetch', 'warm'],
      ['Parallel probe (all servers)', 'ranked'],
      ['Fastest-first manifest', 'active'],
      ['Instant failover', 'ready'],
    ];
    box.innerHTML = rows
      .map(
        ([label], i) => `<li><span class="dot"></span>${label}<span class="ms">${
          ['12 ms', '38 ms', '0.4 s', 'auto'][i]
        }</span></li>`
      )
      .join('');
  }

  function bindToolbar() {
    const input = $('#searchInput');
    if (input) {
      let t;
      input.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => {
          state.q = input.value;
          renderChannels();
        }, 120);
      });
    }
    document.addEventListener('click', (e) => {
      const c = e.target.closest('.channel-card');
      if (c) openPlayer(c.dataset.id);
    });
  }

  /* ═════════════════════ PLAYER ═════════════════════ */
  let current = null; // { channel, hls, video, ranked, idx }

  function closePlayer() {
    if (current?.hls) {
      try { current.hls.destroy(); } catch {}
    }
    const m = $('#playerModal');
    if (m) m.remove();
    if (location.hash.startsWith('#ch=')) history.replaceState(null, '', location.pathname);
    current = null;
  }

  function openPlayer(id) {
    const ch = window.MizanoraStore.channel(id);
    if (!ch) return;
    closePlayer();
    history.replaceState(null, '', '#ch=' + encodeURIComponent(id));

    const ad = state.settings.ads || {};
    const modal = document.createElement('div');
    modal.className = 'player-modal';
    modal.id = 'playerModal';
    modal.innerHTML = `
      <div class="player-shell">
        <div class="player-top">
          ${ch.logo ? `<img src="${esc(ch.logo)}" alt="">` : ''}
          <div>
            <h4>${esc(ch.name)}</h4>
            <div class="sub">${esc(ch.category || 'General')} ${ch.quality ? '· ' + esc(ch.quality) : ''} · <span id="srcLabel">connecting…</span></div>
          </div>
          <button class="btn btn-sm close-x" id="closePlayer" title="Close (Esc)">✕</button>
        </div>
        <div class="video-wrap">
          <video id="videoEl" playsinline controls crossorigin="anonymous"></video>
          <div class="player-state" id="playerState">
            <div><div class="spinner"></div><div id="stateText">Fastest server dhoonda ja raha hai…</div></div>
          </div>
          ${
            ad.enabled && ad.preRollSeconds > 0
              ? `<div class="ad-overlay" id="adOverlay">
                   <div class="ad-box">
                     <div class="tag">Advertisement</div>
                     <h3>${esc(ad.preRollImage ? '' : 'Mizanora TV')}</h3>
                     ${ad.preRollImage ? `<img src="${esc(ad.preRollImage)}" alt="ad">` : ''}
                     <p>${ad.preRollLink ? `<a href="${esc(ad.preRollLink)}" target="_blank" rel="noopener">Sponsored message — visit karein</a>` : 'Aap ka channel <b class="ad-count" id="adCount">' + ad.preRollSeconds + '</b> sec me start hoga.'}</p>
                     <button class="btn btn-sm ad-skip" id="skipAd">Skip ad ▸</button>
                   </div>
                 </div>`
              : ''
          }
        </div>
        <div class="player-bottom">
          <div class="server-panel">
            <h5>Servers — fastest first</h5>
            <div class="server-list" id="serverList"><p class="hint">Probing…</p></div>
          </div>
          <div class="player-info">
            <h5 style="margin:0 0 8px;font-size:.76rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)">Stream info</h5>
            <dl>
              <dt>Channel</dt><dd>${esc(ch.name)}</dd>
              <dt>Category</dt><dd>${esc(ch.category || 'General')}</dd>
              <dt>Mode</dt><dd>${state.mode === 'live' ? 'Live (Firebase)' : 'Demo'}</dd>
              <dt>Link type</dt><dd>${state.mode === 'live' ? 'Signed (hidden origin)' : 'Direct demo'}</dd>
            </dl>
            <p class="hint" style="margin-top:12px">Fastest engine har baar sab servers parallel check karta hai aur sabse kam latency wale se stream start karta hai.</p>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    $('#closePlayer').onclick = closePlayer;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closePlayer();
    });

    const adOverlay = $('#adOverlay');
    if (adOverlay) {
      let n = Number(ad.preRollSeconds || 5);
      const tick = setInterval(() => {
        n -= 1;
        const el = $('#adCount');
        if (el) el.textContent = n > 0 ? n : 0;
        if (n <= 0) {
          clearInterval(tick);
          dismissAd();
        }
      }, 1000);
      function dismissAd() {
        const o = $('#adOverlay');
        if (o) o.remove();
        startStream(ch);
      }
      $('#skipAd').onclick = () => {
        clearInterval(tick);
        dismissAd();
      };
    } else {
      startStream(ch);
    }
  }

  async function startStream(ch) {
    const video = $('#videoEl');
    const stateText = $('#stateText');
    if (!video) return;
    current = { channel: ch, hls: null, video, ranked: [], idx: 0 };

    // 1) servers rank karo
    setState('Fastest server dhoonda ja raha hai…', true);
    let ranked = [];
    if (state.mode === 'live') {
      try {
        const r = await fetch(`/api/health?id=${encodeURIComponent(ch.id)}`);
        const j = await r.json();
        if (j.ok && j.servers) {
          ranked = j.servers.map((s) => ({ label: s.label, ms: s.ms, ok: s.alive, status: s.status }));
        }
      } catch {}
    } else {
      ranked = await window.MizanoraEngine.rankSources(ch);
    }
    if (!ranked.length) ranked = (ch.sources || []).map((s, i) => ({ label: s.label || `Server ${i + 1}`, ms: 0, ok: true }));
    current.ranked = ranked;
    renderServerList(ranked, -1);

    // 2) stream URL set
    const hls = await loadHls();
    const url = state.mode === 'live' ? ch.url : fastestDemoUrl(ch);
    if (!url) {
      setState('Is channel par koi playable source nahi mila.', false);
      return;
    }
    playUrl(video, url, hls);
    const best = ranked.findIndex((s) => s.ok);
    renderServerList(ranked, best >= 0 ? best : 0);
    const lbl = $('#srcLabel');
    if (lbl) {
      const b = ranked[best >= 0 ? best : 0];
      lbl.innerHTML = b ? `${esc(b.label || 'server')} · <b style="color:var(--ok)">${b.ms || 0} ms</b>` : '';
    }
  }

  function fastestDemoUrl(ch) {
    const srcs = (ch.sources || []).filter((s) => s && s.url);
    if (!srcs.length) return null;
    const ranked = current?.ranked || [];
    const bestLabel = ranked.find((r) => r.ok)?.label;
    const best = srcs.find((s) => (s.label || '') === bestLabel);
    return (best || srcs[0]).url;
  }

  function playUrl(video, url, Hls) {
    const stateText = $('#stateText');
    if (Hls && Hls.isSupported()) {
      if (current.hls) current.hls.destroy();
      const h = new Hls({
        lowLatencyMode: true,
        enableWorker: true,
        maxBufferLength: 12,
        maxMaxBufferLength: 30,
        backBufferLength: 30,
        manifestLoadingTimeOut: 8000,
        manifestLoadingMaxRetry: 2,
        fragLoadingMaxRetry: 3,
        startLevel: -1,
        abrEwmaDefaultEstimate: 1200000,
      });
      current.hls = h;
      h.loadSource(url);
      h.attachMedia(video);
      h.on(Hls.Events.MANIFEST_PARSED, () => {
        hideState();
        video.play().catch(() => {});
      });
      h.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          try { h.recoverMediaError(); return; } catch {}
        }
        fallback();
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.addEventListener('loadedmetadata', hideState, { once: true });
      video.play().catch(() => {});
      video.onerror = () => fallback();
    } else {
      setState('Is browser me HLS playback support nahi hai. Chrome/Edge/Firefox use karein.', false);
      return;
    }
    video.onerror = () => fallback();

    function hideState() {
      const s = $('#playerState');
      if (s) s.classList.add('hidden');
    }

    function fallback() {
      const c = current;
      if (!c) return;
      const next = c.idx + 1;
      const srcs = (c.channel.sources || []).filter((s) => s && s.url);
      if (state.mode === 'demo' && srcs[next]) {
        c.idx = next;
        renderServerList(c.ranked, next);
        const lbl = $('#srcLabel');
        if (lbl) lbl.textContent = `${srcs[next].label || 'Server ' + (next + 1)} · failover`;
        playUrl(c.video, srcs[next].url, hlsLib);
        return;
      }
      setState(
        state.mode === 'live'
          ? 'Stream band ho gaya. Dobara try karein — server auto-failover karega.'
          : 'Stream load nahi hua. Demo streams ko internet chahiye (aur browser preview block ho sakta hai). Deploy hone ke baad live Firebase channels chalenge.',
        false
      );
    }
  }

  function setState(text, spin) {
    const box = $('#playerState');
    const t = $('#stateText');
    if (box) box.classList.remove('hidden');
    if (t) t.textContent = text;
    if (box && !spin) {
      const sp = box.querySelector('.spinner');
      if (sp) sp.remove();
    }
  }

  function renderServerList(ranked, activeIdx) {
    const wrap = $('#serverList');
    if (!wrap) return;
    wrap.innerHTML = ranked
      .map(
        (s, i) => `<div class="server-row ${i === activeIdx ? 'active' : ''}">
          <span class="led ${s.ok ? 'ok' : 'bad'}"></span>
          <span>${esc(s.label || 'Server ' + (i + 1))}</span>
          <span class="ms">${s.ok ? (s.ms || 0) + ' ms' : 'offline'}</span>
        </div>`
      )
      .join('');
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePlayer();
  });

  window.MizanoraPlayer = { open: openPlayer, close: closePlayer };

  let booted = false;
  function safeBoot() {
    if (booted) return;
    booted = true;
    boot();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeBoot);
  else safeBoot();
})();
