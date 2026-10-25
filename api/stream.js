/**
 * GET /s/<token>/index.m3u8   →  /api/stream?sig=<token>
 *
 * Ye Mizanora ka DIL hai:
 *  1. signed token verify (asli link kabhi browser ko nahi milta)
 *  2. channel ke saare m3u8 servers ko PARALLEL probe → fastest alive pick
 *  3. manifest fetch → har segment/key URI ko signed /p/<token> me rewrite
 *  4. HLS player ko same-origin clean manifest milta hai (no CORS, no referer block)
 *  5. Fastest server fail ho jaye to agla server automatically (failover retry)
 */
const { getChannel, isReady } = require('./_lib/admin');
const { verify } = require('./_lib/sign');
const { rankSources } = require('./_lib/sources');
const { rewriteManifest, proxyPathFor } = require('./_lib/hls');

function isManifest(ct, url) {
  const t = (ct || '').toLowerCase();
  return t.includes('mpegurl') || t.includes('x-mpegurl') || /\.m3u8(\?|$)/i.test(url || '');
}

async function fetchManifest(url, timeout = 9000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, {
      signal: ctl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (MizanoraTV/1.0)',
        Accept: 'application/vnd.apple.mpegurl,application/x-mpegURL,*/*',
      },
      cache: 'no-store',
    });
    const text = await r.text();
    return { ok: r.ok, status: r.status, text, finalUrl: r.url || url, ct: r.headers.get('content-type') };
  } finally {
    clearTimeout(t);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!isReady()) return res.status(503).send('# Firebase Admin not configured');

  const sig = req.query.sig || req.query.token;
  const payload = verify(sig);
  if (!payload || !payload.id) return res.status(403).send('# Invalid or expired stream token');

  const channel = await getChannel(payload.id);
  if (!channel) return res.status(404).send('# Channel not found');

  // Fastest-first ranking (parallel probe)
  let ranked = [];
  try {
    ranked = await rankSources(channel);
  } catch {
    ranked = [];
  }
  const ordered = ranked.filter((r) => r.ok).concat(ranked.filter((r) => !r.ok));

  for (const src of ordered) {
    try {
      const m = await fetchManifest(src.url);
      if (!m.ok || !m.text) continue;

      if (!isManifest(m.ct, m.finalUrl) && !m.text.includes('#EXTM3U')) {
        // Direct stream (ts/mp4) — bina rewrite ke proxy
        return res.redirect(302, proxyPathFor(m.finalUrl));
      }

      const base = m.finalUrl;
      const body = rewriteManifest(m.text, base, proxyPathFor);

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('X-Mizanora-Source', String(src.label || 'server'));
      res.setHeader('X-Mizanora-Latency', String(src.ms || 0));
      return res.status(200).send(body);
    } catch {
      /* agla server try karo — instant failover */
    }
  }

  return res.status(502).send('# All sources failed. Mizanora fastest-engine ne har server try kiya.');
};
