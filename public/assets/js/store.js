/* Mizanora TV — data layer + fastest-source engine (browser side, demo/fallback) */
(function () {
  const Store = {
    mode: 'demo',
    data: null,
    async init() {
      try {
        const r = await fetch('/api/channels', { headers: { Accept: 'application/json' } });
        if (!r.ok) throw new Error('api ' + r.status);
        const j = await r.json();
        if (!j || !j.ok) throw new Error((j && j.error) || 'bad payload');
        this.mode = 'live';
        this.data = j;
      } catch (e) {
        this.mode = 'demo';
        this.data = window.MIZANORA_DEMO || { ok: false, channels: [], settings: {} };
        console.warn('[Mizanora] API unavailable → demo mode:', e.message);
      }
      if (this.data.settings?.accent) {
        document.documentElement.style.setProperty('--accent', this.data.settings.accent);
      }
      return this.data;
    },
    channel(id) {
      return (this.data?.channels || []).find((c) => c.id === id) || null;
    },
  };

  /* ── browser-side fastest probe (demo mode / manual ranking) ── */
  async function probe(url, timeout = 4000) {
    const t0 = performance.now();
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(url, { signal: ctl.signal, cache: 'no-store' });
      const ms = Math.round(performance.now() - t0);
      clearTimeout(timer);
      return { url, ok: r.ok || r.status === 206, ms, status: r.status };
    } catch (e) {
      clearTimeout(timer);
      return { url, ok: false, ms: Math.round(performance.now() - t0), status: 0, error: e.name };
    }
  }

  async function rankSources(channel) {
    const srcs = (channel?.sources || []).filter((s) => s && (s.url || s.link) && s.enabled !== false);
    if (!srcs.length) return [];
    const results = await Promise.all(
      srcs.map(async (s, i) => {
        const p = await probe(s.url || s.link);
        return { ...p, label: s.label || `Server ${i + 1}`, priority: i, score: p.ok ? p.ms + i * 20 : 1e9 };
      })
    );
    return results.sort((a, b) => a.score - b.score);
  }

  window.MizanoraStore = Store;
  window.MizanoraEngine = { probe, rankSources };
})();
