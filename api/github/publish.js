/**
 * POST /api/github/publish
 * Admin panel se "Publish master.m3u to GitHub" — token SERVER par rehta hai,
 * browser kabhi GitHub token nahi dekhta.
 *
 * Body: { message?: string }
 * Auth: Authorization: Bearer <firebase-id-token>
 */
const { verifyAdmin, getChannels, getSettings } = require('../_lib/admin');
const { streamToken } = require('../_lib/sign');
const { buildM3U } = require('../playlist');

function baseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

async function ghApi(path, opts = {}) {
  const repo = process.env.GITHUB_REPO;
  const r = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'MizanoraTV',
      ...(opts.headers || {}),
    },
  });
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { ok: r.ok, status: r.status, json, text };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  const gate = await verifyAdmin(req);
  if (!gate.ok) return res.status(gate.code).json({ ok: false, error: gate.error });

  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) {
    return res.status(400).json({ ok: false, error: 'GITHUB_TOKEN / GITHUB_REPO set nahi hai (Vercel env)' });
  }

  const path = process.env.GITHUB_PATH || 'data/master.m3u';
  const branch = process.env.GITHUB_BRANCH || 'main';

  const [settings, channels] = await Promise.all([getSettings(), getChannels({ onlyEnabled: true })]);
  const content = buildM3U({ channels, base: baseUrl(req), ttl: Number(settings.streamTokenTtl || 43200) });

  try {
    // current sha (update ke liye zaroori)
    const cur = await ghApi(`/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${branch}`);
    const sha = cur.ok ? cur.json?.sha : undefined;

    const put = await ghApi(`/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: (req.body && req.body.message) || `chore(playlist): update master.m3u — ${new Date().toISOString()}`,
        content: Buffer.from(content, 'utf8').toString('base64'),
        branch,
        ...(sha ? { sha } : {}),
      }),
    });

    if (!put.ok) return res.status(put.status).json({ ok: false, error: put.json?.message || put.text });
    return res.status(200).json({
      ok: true,
      repo: process.env.GITHUB_REPO,
      path,
      branch,
      channels: channels.length,
      commit: put.json?.commit?.sha || null,
      url: put.json?.content?.html_url || null,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
