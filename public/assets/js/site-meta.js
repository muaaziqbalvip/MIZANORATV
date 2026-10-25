/* Mizanora TV — static pages ke liye branding fill (settings se) */
(function () {
  const $$ = (s) => [...document.querySelectorAll(s)];
  async function run() {
    let s = null;
    try {
      const r = await fetch('/api/channels');
      const j = await r.json();
      if (j.ok) s = j.settings;
    } catch {}
    if (!s) s = { siteName: 'Mizanora TV', tagline: 'Fastest Streaming Engine', email: 'contact@mizanora.tv' };
    document.title = document.title.replace(/^Mizanora TV/, s.siteName || 'Mizanora TV');
    $$('[data-site-name]').forEach((el) => (el.textContent = s.siteName || 'Mizanora TV'));
    $$('[data-tagline]').forEach((el) => (el.textContent = s.tagline || 'Fastest Streaming Engine'));
    $$('[data-email]').forEach((el) => {
      el.textContent = s.email || 'contact@mizanora.tv';
      el.href = 'mailto:' + (s.email || 'contact@mizanora.tv');
    });
    if (s.telegram) $$('[data-telegram]').forEach((el) => { el.href = s.telegram; el.classList.remove('hidden'); });
    if (s.accent) document.documentElement.style.setProperty('--accent', s.accent);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
