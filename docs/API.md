# 🔌 Mizanora TV — API Reference

Base URL: `https://your-project.vercel.app`

---

## Public endpoints

### `GET /api/channels`
Public channel list. **Raw m3u8 kabhi return nahi hoti.**

```json
{
  "ok": true,
  "mode": "live",
  "generatedAt": 1760000000000,
  "settings": { "siteName": "Mizanora TV", "accent": "#22d3ee", "ads": { "enabled": true, "preRollSeconds": 5 } },
  "categories": ["Entertainment", "Sports"],
  "total": 12,
  "channels": [
    {
      "id": "mizanora-one",
      "name": "Mizanora One",
      "logo": "https://...",
      "category": "Entertainment",
      "number": 1,
      "sourceCount": 3,
      "url": "/s/<signed-token>/index.m3u8"
    }
  ]
}
```

### `GET /api/health?id=<channelId>`
Fastest-server ranking (URLs hidden).

```json
{
  "ok": true,
  "channel": { "id": "mizanora-one", "name": "Mizanora One" },
  "fastest": "Server 2",
  "servers": [
    { "rank": 1, "label": "Server 2", "ms": 46, "status": 200, "alive": true, "type": "hls" },
    { "rank": 2, "label": "Server 1", "ms": 60, "status": 200, "alive": true, "type": "hls" },
    { "rank": 3, "label": "Server 3", "ms": 291, "status": 200, "alive": true, "type": "hls" }
  ]
}
```

### `GET /s/<signed-token>/index.m3u8`
Signed manifest. Engine:
1. token verify (HMAC, expiry)
2. saare servers parallel probe
3. fastest alive server ka manifest fetch
4. har segment/key URI → `/p/<signed>` rewrite
5. fail → agla server (loop)

Response headers: `X-Mizanora-Source`, `X-Mizanora-Latency`

### `GET /p/<signed-token>`
Signed segment/key proxy. Range requests passthrough. Open proxy nahi — sirf signed URLs.

### `GET /m3u/<PLAYLIST_TOKEN>`
Owner private playlist (M3U). Bina token 403.

### `GET /api/posts`
Blog posts (published only).

---

## Admin endpoints (Bearer Firebase ID token)

### `GET /api/admin/playlist`
```json
{ "ok": true, "privateUrl": "https://.../m3u/<token>", "channels": 12, "playlist": "#EXTM3U\n..." }
```

### `POST /api/github/publish`
Body: `{ "message": "update master.m3u" }`

GitHub me `GITHUB_PATH` (default `data/master.m3u`) commit karta hai.

```json
{ "ok": true, "repo": "user/repo", "path": "data/master.m3u", "branch": "main", "channels": 12, "commit": "abc123", "url": "https://github.com/..." }
```

### `GET /api/health?url=<m3u8>`
Admin-only single URL probe (draft test ke liye).

---

## Xtream Codes API

| Endpoint | Note |
|---|---|
| `GET /player_api.php?username=&password=` | auth + user_info + server_info |
| `...&action=get_live_categories` | categories |
| `...&action=get_live_streams[&category_id=1]` | streams |
| `...&action=get_short_epg&stream_id=1` | EPG |
| `GET /get.php?username=&password=&type=m3u_plus&output=m3u8` | playlist |
| `GET /xmltv.php?username=&password=` | EPG XML |
| `GET /live/<user>/<pass>/<id>.m3u8` | fastest server par 302 |
| `GET /live/<user>/<pass>/<id>.m3u8?direct=1` | seedha upstream par 302 |

---

## Signing

`api/_lib/sign.js`:

```js
sign({ id: "channel1", t: "stream" }, 43200);      // expiry 12h
verify(token);                                     // → payload | null
proxyToken("https://cdn/seg1.ts", 21600);          // segment token
streamToken("channel1", 43200);                    // channel stream token
```

Secret priority: `STREAM_PROXY_SECRET` → `PLAYLIST_TOKEN` → `GITHUB_TOKEN` → dev default.
**Production me `STREAM_PROXY_SECRET` set karein.**

---

## Error codes

| Code | Matlab |
|---|---|
| 401 | missing/invalid Firebase token (admin routes) |
| 403 | not-admin / invalid signed token / private playlist |
| 404 | channel not found |
| 502 | saare upstream servers fail |
| 503 | Firebase Admin not configured |
