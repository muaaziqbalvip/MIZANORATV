/**
 * GET /api/channels
 * Public channel list — asli m3u8 sources kabhi expose nahi hote.
 * Har channel ko signed stream path milta hai: /s/<token>/index.m3u8
 */
const { getChannels, getSettings, isReady, errMessage } = require('./_lib/admin');
const { streamToken } = require('./_lib/sign');

function publicSettings(s = {}) {
  return {
    siteName: s.siteName || 'Mizanora TV',
    tagline: s.tagline || 'Fastest Streaming • Zero Buffering',
    accent: s.accent || '#22d3ee',
    logo: s.logo || '/assets/img/logo.svg',
    aboutText: s.aboutText || '',
    telegram: s.telegram || '',
    whatsapp: s.whatsapp || '',
    email: s.email || '',
    ads: {
      enabled: !!s.adsEnabled,
      banner: s.adBanner || '',
      bannerLink: s.adBannerLink || '',
      preRollSeconds: Number(s.preRollSeconds || 5),
      preRollImage: s.preRollImage || '',
      preRollLink: s.preRollLink || '',
    },
    tokenTtl: Number(s.streamTokenTtl || 43200),
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=15, stale-while-revalidate=60');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!isReady()) {
    return res.status(503).json({
      ok: false,
      error: 'Firebase Admin not configured',
      detail: errMessage(),
      hint: 'Vercel env me FIREBASE_SERVICE_ACCOUNT set karein (README dekhein).',
    });
  }

  try {
    const [settings, channels] = await Promise.all([getSettings(), getChannels({ onlyEnabled: true })]);
    const pub = publicSettings(settings);
    const ttl = pub.tokenTtl;

    const list = channels.map((c) => ({
      id: c.id,
      name: c.name,
      logo: c.logo || '',
      category: c.category || 'General',
      number: c.number || 0,
      epg: c.epg || '',
      description: c.description || '',
      quality: c.quality || '',
      language: c.language || '',
      featured: !!c.featured,
      sourceCount: Array.isArray(c.sources) ? c.sources.length : 0,
      url: `/s/${streamToken(c.id, ttl)}/index.m3u8`,
    }));

    const categories = [...new Set(list.map((c) => c.category))].sort();
    res.setHeader('X-Mizanora-Mode', 'live');
    return res.status(200).json({
      ok: true,
      mode: 'live',
      generatedAt: Date.now(),
      settings: pub,
      categories,
      total: list.length,
      channels: list,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
