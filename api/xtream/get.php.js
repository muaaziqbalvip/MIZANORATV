/**
 * Xtream playlist  →  /get.php?username=..&password=..&type=m3u_plus&output=m3u8
 * (ya owner: /get.php?token=<PLAYLIST_TOKEN>)
 */
const { getChannels, getXtreamUser, isReady } = require('../_lib/admin');

function baseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!isReady()) return res.status(503).send('# Server not configured');

  const q = req.query || {};
  const username = q.username || q.user || '';
  const password = q.password || q.pass || '';
  const output = (q.output || 'm3u8').toLowerCase();
  const isOwner = process.env.PLAYLIST_TOKEN && q.token === process.env.PLAYLIST_TOKEN;

  const user = isOwner ? { username: 'owner' } : await getXtreamUser(username, password);
  if (!user) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(401).send('# Invalid username or password');
  }

  const channels = await getChannels({ onlyEnabled: true });
  const base = baseUrl(req);
  const ext = output === 'ts' ? 'ts' : 'm3u8';

  const u = isOwner ? 'owner' : username;
  const p = isOwner ? process.env.PLAYLIST_TOKEN || '' : password;

  const lines = ['#EXTM3U'];
  lines.push('#PLAYLIST:Mizanora TV');
  channels.forEach((c, i) => {
    const sid = Number(c.streamId) || Number(c.number) || i + 1;
    const tvgId = (c.epg || c.name || '').toString().toLowerCase().replace(/\s+/g, '-');
    lines.push(
      `#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${c.name}" tvg-logo="${c.logo || ''}" group-title="${c.category || 'General'}",${c.name}`
    );
    lines.push(`${base}/live/${encodeURIComponent(u)}/${encodeURIComponent(p)}/${sid}.${ext}`);
  });

  res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="mizanora-${user.username}.m3u"`);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(lines.join('\n') + '\n');
};
