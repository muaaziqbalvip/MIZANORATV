/**
 * GET /api/admin/playlist  (Authorization: Bearer <firebase-id-token>)
 * Owner ko private playlist + token + copy-able links deta hai.
 */
const { verifyAdmin, getChannels, getSettings } = require('../_lib/admin');
const { buildM3U } = require('../playlist');

function baseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const gate = await verifyAdmin(req);
  if (!gate.ok) return res.status(gate.code).json({ ok: false, error: gate.error });

  const base = baseUrl(req);
  const token = process.env.PLAYLIST_TOKEN || '';
  const [settings, channels] = await Promise.all([getSettings(), getChannels({ onlyEnabled: true })]);
  const playlist = buildM3U({ channels, base, ttl: Number(settings.streamTokenTtl || 43200) });

  return res.status(200).json({
    ok: true,
    tokenSet: !!token,
    privateUrl: token ? `${base}/m3u/${token}` : null,
    playlistLength: playlist.length,
    channels: channels.length,
    playlist,
  });
};
