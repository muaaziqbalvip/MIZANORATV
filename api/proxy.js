/**
 * GET /p/<token>  →  /api/proxy?tok=<token>
 * Sirf un URLs ko proxy karta hai jo humne khud sign kiye hain (open proxy nahi).
 * Fayde: CORS bypass, Referer/Geo block bypass, hidden origin, Range passthrough.
 */
const { verify } = require('./_lib/sign');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Origin, Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const tok = String(req.query.tok || req.query.u || '');
  const payload = verify(tok);
  if (!payload || payload.t !== 'proxy' || !payload.u) {
    return res.status(403).send('Forbidden: invalid proxy token');
  }

  let target;
  try {
    target = new URL(payload.u);
  } catch {
    return res.status(400).send('Bad upstream URL');
  }
  if (!/^https?:$/.test(target.protocol)) return res.status(400).send('Bad protocol');

  const headers = {
    'User-Agent': 'Mozilla/5.0 (MizanoraTV/1.0)',
    Accept: '*/*',
  };
  if (req.headers.range) headers.Range = req.headers.range;
  if (req.headers.referer) headers.Referer = target.origin + '/';
  const refererHint = payload.r;
  if (refererHint) headers.Referer = refererHint;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);

  try {
    const upstream = await fetch(target.toString(), {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers,
      signal: ctl.signal,
      redirect: 'follow',
    });

    res.status(upstream.status);
    const pass = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag'];
    pass.forEach((h) => {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    });
    if (!upstream.headers.get('content-type')) res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=2');
    res.setHeader('X-Mizanora-Proxy', '1');

    if (req.method === 'HEAD' || !upstream.body) return res.end();

    const reader = upstream.body.getReader();
    req.on('close', () => reader.cancel().catch(() => {}));
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.write(Buffer.from(value))) {
        await new Promise((r) => res.once('drain', r));
      }
    }
    return res.end();
  } catch (e) {
    if (!res.headersSent) return res.status(504).send('Upstream error: ' + (e.message || e));
    return res.end();
  } finally {
    clearTimeout(timer);
  }
};
