# ⚡ Mizanora TV — 10 Minute Setup (Roman Urdu)

Bhai, ye short version hai. Detail: `README.md` aur `docs/DEPLOY.md`.

---

## Step 1 — Firebase (2 min)
1. console.firebase.google.com → project **mizanora-tv-001**
2. **Authentication** → Sign-in method → **Email/Password** → Enable
3. Authentication → Users → **Add user** → apna email + password (ye owner login hoga)
4. ⚙️ Project settings → **Service accounts** → **Generate new private key** → JSON download
5. **Firestore** → Create database → production mode

## Step 2 — Vercel (3 min)
```bash
cd mizanora-tv
npm i -g vercel
vercel --prod
```
Phir Vercel → Settings → **Environment Variables** (teen environment select karein):

| Key | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | JSON file ka poora content (ek line, jaisa hai waisa) |
| `PUBLIC_BASE_URL` | `https://aapka-project.vercel.app` |
| `PLAYLIST_TOKEN` | `mizanora-private-9f3a71` (koi bhi lamba secret) |
| `STREAM_PROXY_SECRET` | koi random string |
| `GITHUB_TOKEN` | GitHub PAT (Contents: Read & Write) |
| `GITHUB_REPO` | `username/repo` |
| `GITHUB_BRANCH` | `main` |
| `GITHUB_PATH` | `data/master.m3u` |

→ **Redeploy**.

## Step 3 — Owner login (1 min)
`https://aapka-project.vercel.app/admin.html` → email/password → Login.
**Pehla user automatically owner** ban jata hai. Dashboard par "LIVE • Firebase" likha aana chahiye.

## Step 3.5 — Firestore rules
Firebase Console → Firestore → Rules → `firebase/firestore.rules` ka content paste → Publish.

## Step 4 — Channels (2 min)
Admin → **Channels** → `+ Naya channel`:
- Name, category, logo URL
- **jitne m3u8 servers hain** (Server 1, Server 2, Server 3…)
- `⚡ Probe all servers` → latency dekh lein
- **Save channel**

## Step 5 — Test (1 min)
Home page kholein → channel play → player me "Servers — fastest first" me har server ka **ms** dikhega,
aur jo fastest hai wahi chalega.

---

## Xtream panel (players ke liye)
Admin → **Xtream Users** → naya user → username/password.

Player me (TiviMate / Smarters / OTT Navigator):
```
Panel type : Xtream Codes API
Server URL : https://aapka-project.vercel.app
Port       : 443
Username   : (jo banaya)
Password   : (jo password)
```

M3U link:
```
https://aapka-project.vercel.app/get.php?username=USER&password=PASS&type=m3u_plus&output=m3u8
```

---

## Private playlist (sirf aapke liye)
Admin → **System / API** → `🔑 Private link` → copy.
Format: `https://aapka-project.vercel.app/m3u/<PLAYLIST_TOKEN>`

---

## GitHub master.m3u
Admin → **GitHub Publish** → **Publish now** → repo me `data/master.m3u` update ho jayegi.
GitHub token browser me kabhi nahi aata — sirf server par rehta hai.

---

## Important sach (zaroor parhein)
- **"6G speed"** koi software nahi de sakta — wo hardware/ISP ka feature hai.
  Mizanora jo deta hai: **sabse kam latency wala server + parallel probing + low-latency HLS + instant failover**.
  Practically yahi "fastest" hota hai.
- **Bypass**: CORS / Referer / geo block bypass hota hai signed proxy se.
  Lekin DRM-protected ya token-auth streams bypass nahi hote — koi bhi tool nahi kar sakta.
- **Rights**: jo stream aap add karte hain uski legality aapki zimmedari hai.

---

© 2026 Mizanora TV — by **Muaz Iqbal**, Kasur, Pakistan.
