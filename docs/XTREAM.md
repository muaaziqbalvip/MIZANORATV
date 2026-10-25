# 🎬 Xtream Codes / M3U — player setup

Mizanora TV Xtream Codes API jaisa hi API deta hai, is liye zyada tar IPTV players
direct login kar sakte hain.

---

## Credentials kahan se milte hain

1. Admin panel → **Xtream Users** → `+ naya user` (username + password + expiry)
2. Wahi username/password player me daalein
3. Server URL = aapka Vercel domain (`https://your-project.vercel.app`), Port = `443`

Owner ke liye: `/m3u/<PLAYLIST_TOKEN>` (playlist) — ye sab kuch dekh sakta hai.

---

## Endpoints (jo implement hain)

| Endpoint | Kaam |
|---|---|
| `/player_api.php?username=U&password=P` | user info + auth |
| `/player_api.php?...&action=get_live_categories` | categories |
| `/player_api.php?...&action=get_live_streams` | live channels list |
| `/player_api.php?...&action=get_live_streams&category_id=1` | filtered list |
| `/player_api.php?...&action=get_all_channels` | full list |
| `/player_api.php?...&action=get_short_epg&stream_id=1` | EPG single channel |
| `/player_api.php?...&action=get_server_info` | server info |
| `/player_api.php?...&action=get_vod_streams` / `get_series` | khaali array (VOD abhi nahi) |
| `/get.php?username=U&password=P&type=m3u_plus&output=m3u8` | M3U playlist |
| `/xmltv.php?username=U&password=P` | EPG XMLTV |
| `/live/U/P/<stream_id>.m3u8` | fastest server par redirect |

Stream ID = channel ka `number` (ya `streamId` field agar set ho).

---

## Player-by-player

### TiviMate (Android TV / Firebox)
1. Add playlist → **Xtream Codes**
2. Name: `Mizanora TV`
3. URL: `https://your-project.vercel.app`
4. Port: `443`
5. Username/Password → Next → channels load

### IPTV Smarters Pro
1. Login with Xtream Codes API
2. Any name → username → password
3. URL: `https://your-project.vercel.app:443`

### VLC (desktop)
Media → Open Network Stream:
```
https://your-project.vercel.app/get.php?username=U&password=P&type=m3u_plus&output=m3u8
```

### MX Player / OTT Navigator / Perfect Player
M3U URL hi daal dein (upar wala format). OTT Navigator me EPG ke liye:
```
https://your-project.vercel.app/xmltv.php?username=U&password=P
```

### Web browser (hls.js)
`https://your-project.vercel.app` — channels grid se direct play.

---

## EPG

Agar aapke paas apna XMLTV source hai:
- Admin → Settings → (EPG URL field future me) — filhal `/xmltv.php` channels ka skeleton deta hai
- Ya player me "EPG URL" me apna XMLTV daal dein, `tvg-id` channel ke `epg` field se match karein

---

## Common errors

| Player me error | Wajah | Hal |
|---|---|---|
| `auth: 0` / invalid | username/password galat ya user inactive/expired | Admin → Xtream Users check |
| Channels list khaali | koi channel enabled nahi | Admin → Channel status "Enabled" |
| Stream nahi chalti | upstream source down | Admin → Test / Probe |
| 403 on `/live/...` | user expired | expiry barha dein |
| Buffer zyada | upstream slow | multiple servers add karein — engine fastest chusega |

---

## Security note

- Raw upstream m3u8 ka link **kisi player me nahi jata** jab tak aap `?direct=1` use na karein.
  Default me player ko Mizanora signed manifest milta hai.
- `/live/U/P/id.m3u8?direct=1` sirf un players ke liye hai jo 302 redirect handle nahi karte.
  Isse raw source expose ho sakta hai — ehtiyat se use karein.
