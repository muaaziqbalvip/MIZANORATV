/**
 * Mizanora TV — Signed URL helper (HMAC-SHA256)
 * Asli m3u8 links kabhi browser ko expose nahi hote.
 * Browser sirf /s/<signed>/index.m3u8 aur /p/<signed> dekhta hai.
 */
const crypto = require('crypto');

const SECRET =
  process.env.STREAM_PROXY_SECRET ||
  process.env.PLAYLIST_TOKEN ||
  process.env.GITHUB_TOKEN ||
  'mizanora-dev-secret-change-me';

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(s + '='.repeat((4 - (s.length % 4)) % 4), 'base64').toString('utf8');
}
function hmac(data) {
  return b64url(crypto.createHmac('sha256', SECRET).update(data).digest());
}

/** obj → token (ttl seconds) */
function sign(obj, ttlSec = 60 * 60 * 12) {
  const payload = { ...obj, exp: Math.floor(Date.now() / 1000) + ttlSec };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${hmac(body)}`;
}

/** token → obj | null */
function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  if (hmac(body) !== sig) return null;
  try {
    const obj = JSON.parse(unb64url(body));
    if (obj.exp && Date.now() / 1000 > obj.exp) return null;
    return obj;
  } catch {
    return null;
  }
}

/** Stream token for a channel id */
function streamToken(channelId, ttlSec) {
  return sign({ id: String(channelId), t: 'stream' }, ttlSec);
}

/** Proxy token for an absolute upstream URL */
function proxyToken(url, ttlSec = 60 * 60 * 6) {
  return sign({ u: url, t: 'proxy' }, ttlSec);
}

module.exports = { sign, verify, streamToken, proxyToken, b64url, unb64url };
