# 📺 Mizanora TV — Complete Streaming System

> Multi-server HLS live TV · **fastest-source engine** · signed hidden links · Xtream Codes API · Firebase + Vercel + GitHub · private owner playlist.
>
> **Designed & developed by Muaz Iqbal** — Kasur, Punjab, Pakistan.

---

## ⚡ 1 minute overview

| Feature | Kya karta hai |
|---|---|
| **Fastest-source engine** | Har channel ke saare `m3u8` servers parallel probe hote hain (4s timeout). Sabse kam TTFB wale server ka manifest serve hota hai. Result 45s cache. |
| **Instant failover** | Fastest server beech me mar jaye → list ka agla alive server automatic. Player ko restart nahi karna padta. |
| **Signed hidden links** | Raw `m3u8` browser ko kabhi nahi milta. `/s/<hmac-token>/index.m3u8` + har segment `/p/<hmac-token>` — expiry ke sath. |
| **Bypass layer** | CORS / Referer / geo blocks signed proxy se toot jate hain (sab same-origin). |
| **Xtream Codes API** | `player_api.php`, `get.php`, `xmltv.php`, `/live/user/pass/id.m3u8` — TiviMate, Smarters, VLC, MX Player. |
| **Admin panel** | Channels + multiple m3u8 servers, live latency probe, Xtream users, ads/pre-roll, settings, blog posts. |
| **GitHub master M3U** | Ek click me `data/master.m3u` repo me commit. GitHub token **server-side** rehta hai. |
| **Private playlist** | `/m3u/<PLAYLIST_TOKEN>` — sirf aapke paas. |
| **Blog + Legal** | Blog, About, Privacy Policy, Terms, DMCA, Disclaimer — sab ready. |

**Honest note:** "6G speed" hardware/ISP ka feature hai — koi software network ko 6G nahi bana sakta.
Mizanora jo deta hai: **lowest-latency source + parallel probing + low-latency HLS tuning + pre-buffer + instant failover**.
Practically yahi "fastest" experience hai (aur industry me isi ko fast kehte hain).

---

## 🗂 Project structure

```
mizanora-tv/
├── api/                          # Vercel serverless functions (Node 20)
│   ├── channels.js               # public channel list (signed links only)
│   ├── stream.js                 # /s/<token>/index.m3u8  → fastest server + manifest rewrite
│   ├── proxy.js                  # /p/<token>             → signed segment/key proxy (bypass)
│   ├── health.js                 # server latency ranking (public, no URLs)
│   ├── playlist.js               # /m3u/<PLAYLIST_TOKEN>  → private owner playlist
│   ├── posts.js                  # blog posts
│   ├── live/[...path].js         # Xtream style /live/user/pass/id.m3u8
│   ├── xtream/
│   │   ├── player_api.php.js     # Xtream Codes API
│   │   ├── get.php.js            # M3U playlist
│   │   └── xmltv.php.js          # EPG
│   ├── github/publish.js         # master.m3u → GitHub (admin only)
│   ├── admin/playlist.js         # private playlist for admin panel
│   └── _lib/
│       ├── admin.js              # Firebase Admin SDK + Firestore helpers
│       ├── sources.js            # ⚡ fastest-source engine (probe + rank + race)
│       ├── sign.js               # HMAC-SHA256 signed tokens
│       └── hls.js                # HLS manifest rewriter
├── public/                       # static frontend (no build step)
│   ├── index.html                # home + channel grid + player
│   ├── admin.html                # admin panel
│   ├── blog.html · about.html · legal.html
│   ├── assets/css/app.css        # design system
│   ├── assets/js/
│   │   ├── app.js                # home + player (hls.js)
│   │   ├── admin.js              # admin panel (Firebase / demo)
│   │   ├── store.js              # data layer + browser probe
│   │   ├── demo-data.js          # offline demo channels
│   │   ├── blog.js · site-meta.js
│   ├── manifest.json · sw.js     # PWA
├── firebase/
│   ├── firestore.rules           # locked-down rules
│   └── firestore.indexes.json
├── data/
│   ├── channels.sample.json      # import/seed format
│   └── master.m3u                # generated playlist
├── scripts/
│   ├── seed.js                   # Firestore seeder
│   ├── make-master-m3u.js        # local master.m3u generator
│   └── self-test.js              # 57 checks (syntax, files, sign, hls)
├── docs/
│   ├── DEPLOY.md                 # step-by-step Vercel + Firebase
│   ├── XTREAM.md                 # player setup
│   └── API.md                    # endpoints reference
├── vercel.json · package.json · .env.example
└── README.md
```

---

## 🚀 Deploy (5 steps)

Full detail: **[docs/DEPLOY.md](docs/DEPLOY.md)**

### Step 1 — Firebase service account
Firebase Console → **mizanora-tv-001** → ⚙️ Project settings → **Service accounts** →
**Generate new private key** → JSON download.

### Step 2 — Vercel project
```bash
npm i -g vercel
cd mizanora-tv
vercel            # link/create project
vercel --prod
```
Vercel → Project → **Settings → Environment Variables** me ye add karein:

| Key | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | service account JSON (ek line me, jaisa hai waisa paste karein) |
| `PUBLIC_BASE_URL` | `https://your-project.vercel.app` |
| `PLAYLIST_TOKEN` | koi lamba random secret (private playlist) |
| `GITHUB_TOKEN` | GitHub PAT — fine-grained, **Contents: Read & Write** |
| `GITHUB_REPO` | `username/repo` |
| `GITHUB_BRANCH` | `main` |
| `GITHUB_PATH` | `data/master.m3u` |
| `STREAM_PROXY_SECRET` | (optional) signed links ka secret |

Phir **Redeploy**.

### Step 3 — Admin owner banao
Firebase Console → **Authentication → Users → Add user** (email + password).
Site kholen → `/admin.html` → login. **Pehla login karne wala automatically owner** ban jata hai
(`admins` collection me entry).

### Step 4 — Channels add karein
Admin → **Channels** → `+ Naya channel` → logo, category, aur **jitne m3u8 servers hain** (Server 1, 2, 3…)
→ `⚡ Probe all servers` se latency dekh lein → Save.
Bulk import bhi hai (JSON).

### Step 5 — Publish + share
- Admin → **GitHub Publish** → `Publish now` → `data/master.m3u` repo me commit ho jayegi.
- Admin → **System / API** → `🔑 Private link` → `/m3u/<PLAYLIST_TOKEN>` — yehi aapki private playlist hai.
- Public site: `https://your-project.vercel.app` — channels chalti hain, raw links hidden.

---

## 🎬 Xtream Codes setup (players)

Panel me daalein:

| Field | Value |
|---|---|
| Panel type | **Xtream Codes API** |
| Name | Mizanora TV |
| Server URL | `https://your-project.vercel.app` |
| Port | `443` |
| Username | Admin → Xtream Users me jo banaya |
| Password | wahi password |

M3U alternative:
```
https://your-project.vercel.app/get.php?username=USER&password=PASS&type=m3u_plus&output=m3u8
```

Detail: **[docs/XTREAM.md](docs/XTREAM.md)**

---

## 🔐 Owner-only cheezein

| Cheez | Kahan |
|---|---|
| Asli m3u8 sources | Firestore (`channels`) — public API kabhi return nahi karti |
| Private playlist | `/m3u/<PLAYLIST_TOKEN>` (env secret) |
| GitHub token | Vercel env — browser me kabhi nahi |
| Admin access | Firebase Auth + `admins` collection + Firestore rules |
| Stream links | HMAC signed, default 12h expiry (Settings → TTL) |

---

## 🧪 Local development

```bash
npm install                # sirf firebase-admin (seed ke liye)
npm i -g vercel
vercel dev                 # http://localhost:3000  (API + frontend dono)
```

Ya sirf UI dekhna hai:
```bash
cd public && python3 -m http.server 8099
# demo mode: demo channels, player, admin (localStorage) — sab chalta hai
```

Self test:
```bash
npm run check              # 57 checks
node scripts/make-master-m3u.js data/channels.sample.json data/master.m3u
```

---

## 🧠 Fastest engine kaise kaam karta hai

```
1. Browser → /s/<signed>/index.m3u8
2. api/stream.js → verify token → channel load
3. sources.js → ALL servers parallel probe (4s timeout, TTFB measure)
4. sorted fastest-first → manifest fetch (failover loop)
5. hls.js rewrite → har segment/key → /p/<signed> (same-origin, bypass)
6. probe cache 45s → agla play instant
```

Browser-side (player modal) me har server ka **live ms** bhi dikhta hai — `/api/health?id=<channel>`.

---

## 📄 Pages

| Page | Path |
|---|---|
| Home (channels + player) | `/` |
| Admin panel | `/admin.html` |
| Blog | `/blog.html` |
| About + system design + developer | `/about.html` |
| Privacy / Terms / DMCA / Disclaimer | `/legal.html` |

---

## ⚖️ Legal (zaroori)

Mizanora TV koi content host ya distribute nahi karta — ye sirf aapke apne add kiye hue
sources ke liye player + management layer hai. Aap jo source add karte hain uske rights
aapki zimmedari hain. `legal.html` me Privacy, Terms, DMCA aur Disclaimer maujood hain.

---

## 👤 Developer

**Muaz Iqbal** — Developer, Kasur, Punjab, Pakistan
Mizanora TV (design + engineering), fastest-source engine, Xtream compatibility layer, signed-link delivery.

> Note: internet par "Muaz Iqbal / Kasur" ke verified public profiles nahi mile, is liye
> bio sirf project-based hai. `about.html` me aap apne links (GitHub/LinkedIn/portfolio) add kar sakte hain.

---

© 2026 Mizanora TV · MIT License
