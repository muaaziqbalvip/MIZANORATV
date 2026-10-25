/**
 * GET /api/posts — public blog posts (Firestore `posts` collection)
 */
const { getPosts, isReady } = require('./_lib/admin');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!isReady()) return res.status(503).json({ ok: false, error: 'not-configured', posts: [] });
  try {
    const posts = await getPosts();
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=600');
    return res.status(200).json({
      ok: true,
      total: posts.length,
      posts: posts.map((p) => ({
        id: p.id,
        slug: p.slug || p.id,
        title: p.title || 'Untitled',
        excerpt: p.excerpt || '',
        body: p.body || '',
        tag: p.tag || 'Guide',
        author: p.author || 'Muaz Iqbal',
        createdAt: p.createdAt || 0,
        published: p.published !== false,
      })).filter((p) => p.published),
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
