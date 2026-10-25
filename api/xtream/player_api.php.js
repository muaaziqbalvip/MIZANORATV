/**
 * Xtream Codes compatible API  →  /player_api.php
 * Actions: user info, get_live_categories, get_live_streams, get_vod_*, get_series_*,
 *          get_short_epg, get_all_channels, get_server_info
 */
const { getChannels, getSettings, getXtreamUser, isReady } = require('../_lib/admin');

function baseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function ensureStreamId(c, index) {
  return Number(c.streamId) || Number(c.number) || index + 1;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!isReady()) return res.status(503).json({ user_info: { auth: 0, status: 'Server not configured' } });

  const q = req.query || {};
  const username = q.username || q.user || '';
  const password = q.password || q.pass || '';
  const action = q.action || '';

  // Owner master access (private, sirf token se)
  const isOwner = process.env.PLAYLIST_TOKEN && (q.token === process.env.PLAYLIST_TOKEN);

  const user = isOwner ? { username: 'owner', maxConnections: 99, expDate: 0 } : await getXtreamUser(username, password);
  const base = baseUrl(req);
  const serverInfo = {
    url: base.replace(/^https?:\/\//, ''),
    port: base.startsWith('https') ? '443' : '80',
    https_port: '443',
    server_protocol: 'https',
    rtmp_port: '0',
    timezone: 'Asia/Karachi',
    timestamp_now: Math.floor(Date.now() / 1000),
    time_now: new Date().toISOString().slice(0, 19).replace('T', ' '),
  };

  if (!user) {
    return res.status(200).json({
      user_info: { username, password: '****', auth: 0, status: 'Invalid username or password', exp_date: null, is_trial: '0', active_cons: '0', created_at: null, max_connections: '1' },
      server_info: serverInfo,
    });
  }

  const channels = await getChannels({ onlyEnabled: true });

  if (!action) {
    const exp = Number(user.expDate || 0);
    return res.status(200).json({
      user_info: {
        username: user.username || username,
        password: password || '****',
        message: 'Welcome to Mizanora TV',
        auth: 1,
        status: 'Active',
        exp_date: exp ? String(exp) : null,
        is_trial: user.isTrial ? '1' : '0',
        active_cons: '1',
        created_at: String(user.createdAt || Math.floor(Date.now() / 1000)),
        max_connections: String(user.maxConnections || 1),
        allowed_output_formats: ['m3u8', 'ts'],
      },
      server_info: serverInfo,
    });
  }

  const settings = await getSettings();
  const categoryFilter = q.category_id ? String(q.category_id) : null;

  switch (action) {
    case 'get_live_categories': {
      const cats = [...new Set(channels.map((c) => c.category || 'General'))];
      return res.status(200).json(
        cats.map((name, i) => ({ category_id: String(i + 1), category_name: name, parent_id: 0 }))
      );
    }

    case 'get_live_streams':
    case 'get_all_channels': {
      const cats = [...new Set(channels.map((c) => c.category || 'General'))];
      let list = channels.map((c, i) => {
        const idx = cats.indexOf(c.category || 'General') + 1;
        return {
          num: ensureStreamId(c, i),
          name: c.name,
          stream_type: 'live',
          stream_id: ensureStreamId(c, i),
          stream_icon: c.logo || '',
          epg_channel_id: c.epg || String(c.id),
          added: String(Math.floor((c.createdAt || Date.now()) / 1000)),
          category_id: String(idx),
          custom_sid: '',
          tv_archive: c.archive ? 1 : 0,
          direct_source: '',
          tv_archive_duration: c.archive ? Number(c.archiveDays || 0) : 0,
        };
      });
      if (categoryFilter && action === 'get_live_streams') {
        list = list.filter((s) => s.category_id === categoryFilter);
      }
      return res.status(200).json(list);
    }

    case 'get_vod_categories':
    case 'get_series_categories':
    case 'get_vod_streams':
    case 'get_series':
      return res.status(200).json([]);

    case 'get_short_epg': {
      const ch = channels.find((c) => String(ensureStreamId(c, 0)) === String(q.stream_id));
      return res.status(200).json({
        epg_listings: [
          {
            id: q.stream_id || '0',
            epg_id: q.stream_id || '0',
            title: Buffer.from(ch ? ch.name : 'Mizanora TV').toString('base64'),
            lang: 'en',
            start: new Date().toISOString().slice(0, 19).replace('T', ' '),
            end: new Date(Date.now() + 36e5).toISOString().slice(0, 19).replace('T', ' '),
            description: Buffer.from(ch?.description || 'Live on Mizanora TV').toString('base64'),
            channel_id: q.stream_id || '0',
            start_timestamp: String(Math.floor(Date.now() / 1000)),
            stop_timestamp: String(Math.floor(Date.now() / 1000) + 3600),
            now_playing: 1,
            has_archive: 0,
          },
        ],
      });
    }

    case 'get_server_info':
      return res.status(200).json({ ...serverInfo, site: settings.siteName || 'Mizanora TV' });

    default:
      return res.status(200).json([]);
  }
};
