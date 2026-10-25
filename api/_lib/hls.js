/**
 * HLS manifest rewriting: har segment/key URI ko signed proxy path me badal deta hai.
 * Isse (a) asli links chhup jate hain, (b) CORS / Referer block bypass hota hai.
 */
const { proxyToken } = require('./sign');

function absUrl(u, base) {
  try {
    return new URL(u, base).toString();
  } catch {
    return u;
  }
}

function rewriteManifest(text, baseUrl, makeProxyPath) {
  const base = baseUrl || '';
  return String(text)
    .split(/\r?\n/)
    .map((line) => {
      const l = line.trim();
      if (!l) return line;

      // URI="..." attributes (EXT-X-KEY, EXT-X-MAP, EXT-X-MEDIA, EXT-X-I-FRAME-STREAM-INF)
      if (l.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (m, uri) => {
          if (uri.startsWith('data:') || uri.startsWith('/p/')) return m;
          return `URI="${makeProxyPath(absUrl(uri, base))}"`;
        });
      }

      // Variant playlist ya media segment line
      if (l.startsWith('/p/')) return line;
      return makeProxyPath(absUrl(l, base));
    })
    .join('\n');
}

/** Segment/key request ko signed proxy path banata hai */
function proxyPathFor(url) {
  return `/p/${proxyToken(url)}`;
}

module.exports = { rewriteManifest, proxyPathFor, absUrl };
