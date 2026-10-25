/**
 * /live/<username>/<password>/<stream_id>.m3u8   (Xtream style)
 * → fastest server resolve → HLS player ko 302 redirect signed manifest par
 *
 * Query:
 *   ?direct=1  → seedha asli source par redirect (purane boxes ke liye)
 *   ?ts=1      → force redirect
 */
const { getChannels, getXtreamUser, isReady } = require('../_lib/admin');
const { streamToken } = require('../_lib/sign');
const { pickFastest } = require('../_lib/sources');

function baseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!isReady()) return res.status(503).send('# Server not configured');

  const parts = Array.isArray(req.query.path) ? req.query.path : String(req.query.path || '').split('/').filter(Boolean);
  const [username, password, file] = parts;
  if (!username || !password || !file) return res.status(400).send('# Bad request: /live/user/pass/id.m3u8');

  const isOwner = process.env.PLAYLIST_TOKEN && username === 'owner' && password === process.env.PLAYLIST_TOKEN;
  const user = isOwner ? { username: 'owner' } : await getXtreamUser(username, password);
  if (!user) return res.status(403).send('# Unauthorized');

  const streamId = String(file).replace(/\.(m3u8|ts|mp4|mkv)$/i, '');
  const channels = await getChannels({ onlyEnabled: true });
  const channel =
    channels.find((c, i) => String(Number(c.streamId) || Number(c.number) || i + 1) === streamId) ||
    channels.find((c) => String(c.id) === streamId);

  if (!channel) return res.status(404).send('# Channel not found');

  const { best } = await pickFastest(channel);
  if (!best || !best.url) return res.status(502).send('# No working source');

  if (req.query.direct === '1' || req.query.direct === 'true') {
    return res.redirect(302, best.finalUrl || best.url);
  }

  const base = baseUrl(req);
  return res.redirect(302, `${base}/s/${streamToken(channel.id, 43200)}/index.m3u8`);
};
