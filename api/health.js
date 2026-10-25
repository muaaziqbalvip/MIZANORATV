/**
 * GET /api/health?id=<channelId>   → saare servers ki live latency ranking
 * (URLs nahi batata — sirf label, latency, status. Safe for public site.)
 * GET /api/health?url=<m3u8>&probe=1  → admin-only single URL probe
 */
const { getChannel, isReady, verifyAdmin } = require('./_lib/admin');
const { rankSources, probeOne } = require('./_lib/sources');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!isReady()) return res.status(503).json({ ok: false, error: 'not-configured' });

  try {
    if (req.query.url) {
      const gate = await verifyAdmin(req);
      if (!gate.ok) return res.status(gate.code).json({ ok: false, error: gate.error });
      const r = await probeOne({ url: String(req.query.url), label: 'probe' });
      return res.status(200).json({ ok: true, probe: r });
    }

    const id = req.query.id;
    if (!id) return res.status(400).json({ ok: false, error: 'id required' });
    const ch = await getChannel(id);
    if (!ch) return res.status(404).json({ ok: false, error: 'channel not found' });

    const ranked = await rankSources(ch);
    return res.status(200).json({
      ok: true,
      channel: { id: ch.id, name: ch.name },
      fastest: ranked.find((r) => r.ok)?.label || null,
      servers: ranked.map((r, i) => ({
        rank: i + 1,
        label: r.label,
        ms: r.ms,
        status: r.status,
        alive: r.ok,
        type: r.type,
        error: r.error || null,
      })),
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
