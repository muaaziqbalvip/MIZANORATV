/**
 * GET /m3u/<token>  →  /api/playlist?token=<token>
 * Owner ka PRIVATE playlist — sirf PLAYLIST_TOKEN ya signed token wale ko milta hai.
 * (GitHub master.m3u bhi isi format me generate hoti hai.)
 */
const { getChannels, getSettings, isReady } = require('./_lib/admin');
const { streamToken, verify } = require('./_lib/sign');

function baseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function buildM3U({ channels, base, ttl, header = true }) {
  const lines = [];
  if (header) {
    lines.push('#EXTM3U');
    lines.push(`#PLAYLIST:Mizanora TV — generated ${new Date().toISOString()}`);
    lines.push('#EXTVLCOPT:http-user-agent=MizanoraTV/1.0');
  }
  channels.forEach((c) => {
    const tvgId = (c.epg || c.name || '').toString().toLowerCase().replace(/\s+/g, '-');
    const logo = c.logo || '';
    const group = c.category || 'General';
    const url = `${base}/s/${streamToken(c.id, ttl)}/index.m3u8`;
    lines.push(
      `#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${c.name}" tvg-logo="${logo}" group-title="${group}",${c.name}`
    );
    if (c.description) lines.push(`#EXTGRP:${group}`);
    lines.push(url);
  });
  return lines.join('\n') + '\n';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!isReady()) return res.status(503).send('# not configured');

  const token = String(req.query.token || '');
  const allowed = (process.env.PLAYLIST_TOKEN && token === process.env.PLAYLIST_TOKEN) || !!verify(token);
  if (!allowed) return res.status(403).send('# Forbidden: private playlist');

  const [settings, channels] = await Promise.all([getSettings(), getChannels({ onlyEnabled: true })]);
  const body = buildM3U({
    channels,
    base: baseUrl(req),
    ttl: Number(settings.streamTokenTtl || 43200),
  });

  res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="mizanora.m3u"');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(body);
};

module.exports.buildM3U = buildM3U;
