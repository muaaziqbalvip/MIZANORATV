/* Mizanora TV — Blog renderer (Firestore posts ya offline fallback) */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s = '') => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const FALLBACK = [
    {
      id: 'fastest-m3u8',
      slug: 'fastest-m3u8',
      title: 'Fastest m3u8 source kaise chunte hain?',
      excerpt: 'TTFB, TLS handshake aur parallel probing — latency ka asal math.',
      tag: 'Guide',
      author: 'Muaz Iqbal',
      createdAt: Math.floor(Date.now() / 1000) - 86400 * 3,
      body: `## Latency sirf bandwidth nahi hai
Ek source "fast" nahi hota kyunki uski bandwidth zyada hai. Fast ka matlab hai: **pehla byte jaldi aaya**.

### Mizanora engine ka formula
- Har URL ko **parallel** probe kiya jata hai (serial nahi — warna 4 servers = 4x wait)
- Timeout **4 second**, kyunki iske baad user chala jata hai
- Score = TTFB + (priority × 15 ms) — priority sirf tie-breaker hai
- Result **45 second cache** hota hai (warm server par instant)

### Player side tuning
\`lowLatencyMode\`, chhota buffer (12s), aur \`startLevel: -1\` se ABR khud best quality chunta hai.
Result: kam buffer, tez start, aur buffer stalls almost zero.`,
    },
    {
      id: 'xtream-setup',
      slug: 'xtream-setup',
      title: 'Xtream Codes API: 5 minute setup',
      excerpt: 'TiviMate, Smarters aur VLC me apna Mizanora server kaise add karein.',
      tag: 'Setup',
      author: 'Muaz Iqbal',
      createdAt: Math.floor(Date.now() / 1000) - 86400 * 6,
      body: `## Steps
1. Admin panel → **Xtream Users** → naya user banayein (username/password)
2. Server URL: aapka Vercel domain (https://...)
3. Port: 443
4. Player me login → live channels auto load

### M3U link
\`/get.php?username=USER&password=PASS&type=m3u_plus&output=m3u8\`

### EPG
\`/xmltv.php?username=USER&password=PASS\`

Agar user inactive ya expire ho jaye to API foran auth 0 return karti hai.`,
    },
    {
      id: 'signed-links',
      slug: 'signed-links',
      title: 'Signed links se source chhupana',
      excerpt: 'HMAC tokens, expiry aur proxy — raw stream URLs ko browser se door rakhna.',
      tag: 'Security',
      author: 'Muaz Iqbal',
      createdAt: Math.floor(Date.now() / 1000) - 86400 * 9,
      body: `## Masla
Agar raw m3u8 browser me aa jaye, koi bhi usay copy kar ke apne panel me daal sakta hai.

## Hal
- Har channel ke liye **HMAC-SHA256 signed token** (expiry 12h default)
- Manifest ke andar har segment aur key URI bhi signed \`/p/<token>\` ban jata hai
- Origin server ko browser kabhi nahi dekhta — sab same-origin lagta hai
- Referer / CORS / geo blocks automatically bypass ho jate hain

## Faida
Aapki playlist ka link sirf aapke paas. Public site par channel chalta hai, source nahi milta.`,
    },
  ];

  function md(src = '') {
    const lines = String(src).split(/\r?\n/);
    let out = '';
    let inList = false;
    const inline = (t) =>
      esc(t)
        .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    lines.forEach((line) => {
      const l = line.trim();
      if (/^###\s/.test(l)) { if (inList) { out += '</ul>'; inList = false; } out += `<h3>${inline(l.slice(4))}</h3>`; }
      else if (/^##\s/.test(l)) { if (inList) { out += '</ul>'; inList = false; } out += `<h2>${inline(l.slice(3))}</h2>`; }
      else if (/^[-*]\s/.test(l)) { if (!inList) { out += '<ul>'; inList = true; } out += `<li>${inline(l.slice(2))}</li>`; }
      else if (/^\d+\.\s/.test(l)) { if (!inList) { out += '<ul>'; inList = true; } out += `<li>${inline(l.replace(/^\d+\.\s/, ''))}</li>`; }
      else if (!l) { if (inList) { out += '</ul>'; inList = false; } }
      else { if (inList) { out += '</ul>'; inList = false; } out += `<p>${inline(l)}</p>`; }
    });
    if (inList) out += '</ul>';
    return out;
  }

  function dateStr(ts) {
    const d = new Date(Number(ts) * 1000);
    return isNaN(d) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  async function load() {
    let posts = FALLBACK;
    try {
      const r = await fetch('/api/posts');
      const j = await r.json();
      if (j.ok && Array.isArray(j.posts) && j.posts.length) posts = j.posts;
    } catch {}
    posts = posts.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const list = $('#postList');
    if (list) {
      list.innerHTML = posts
        .map(
          (p) => `<a class="card post-card" href="#${esc(p.slug || p.id)}" data-slug="${esc(p.slug || p.id)}">
            <time>${esc(p.tag || 'Guide')} · ${dateStr(p.createdAt)}</time>
            <h3>${esc(p.title)}</h3>
            <p>${esc(p.excerpt || '')}</p>
          </a>`
        )
        .join('');
    }

    function show(slug, scroll = true) {
      const p = posts.find((x) => (x.slug || x.id) === slug) || posts[0];
      const art = $('#postArticle');
      if (!art || !p) return;
      art.innerHTML = `
        <time style="font-size:.76rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em">${esc(p.tag || 'Guide')} · ${dateStr(p.createdAt)} · ${esc(p.author || 'Muaz Iqbal')}</time>
        <h1>${esc(p.title)}</h1>
        <p style="color:var(--muted)">${esc(p.excerpt || '')}</p>
        ${md(p.body || '')}
        <hr style="border:none;border-top:1px solid var(--line);margin:26px 0">
        <p class="hint">Written by <b>${esc(p.author || 'Muaz Iqbal')}</b> — Mizanora TV developer, Kasur, Pakistan.</p>`;
      if (scroll) art.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-slug]');
      if (!a) return;
      e.preventDefault();
      const slug = a.dataset.slug;
      history.replaceState(null, '', '#' + slug);
      show(slug);
    });

    const initial = (location.hash || '').replace('#', '');
    show(initial || (posts[0] && (posts[0].slug || posts[0].id)), !!initial);
  }

  document.addEventListener('DOMContentLoaded', load);
  if (document.readyState !== 'loading') load();
})();
