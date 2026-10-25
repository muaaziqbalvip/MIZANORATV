/**
 * EPG  →  /xmltv.php?username=..&password=..
 * Channels ka XMLTV skeleton (aap apna EPG URL settings me daal kar bhi use kar sakte hain).
 */
const { getChannels, getXtreamUser, isReady } = require('../_lib/admin');

function esc(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!isReady()) return res.status(503).send('<?xml version="1.0"?><tv></tv>');

  const q = req.query || {};
  const isOwner = process.env.PLAYLIST_TOKEN && q.token === process.env.PLAYLIST_TOKEN;
  const user = isOwner ? { username: 'owner' } : await getXtreamUser(q.username, q.password);
  if (!user) return res.status(403).send('Unauthorized');

  const channels = await getChannels({ onlyEnabled: true });
  const out = ['<?xml version="1.0" encoding="UTF-8"?>', '<tv generator-info-name="Mizanora TV">'];
  channels.forEach((c) => {
    const id = c.epg || c.name.toLowerCase().replace(/\s+/g, '-');
    out.push(`  <channel id="${esc(id)}"><display-name>${esc(c.name)}</display-name>`);
    if (c.logo) out.push(`    <icon src="${esc(c.logo)}"/>`);
    out.push('  </channel>');
  });
  out.push('</tv>');

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=600');
  return res.status(200).send(out.join('\n'));
};
