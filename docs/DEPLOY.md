# 🚀 Mizanora TV — Deployment Guide (Vercel + Firebase + GitHub)

Ye guide bilkul shuru se end tak le jayegi. Har step copy-paste ready hai.

---

## 0. Requirements

- Node.js 20+
- GitHub account (repo ke liye)
- Vercel account (free plan kaafi hai)
- Firebase project: **mizanora-tv-001** (already aapke paas hai)

---

## 1. Firebase setup

### 1.1 Authentication enable karein
Firebase Console → **Authentication** → *Get started* → **Sign-in method** →
**Email/Password** → Enable → Save.

### 1.2 Owner user banayein
Authentication → **Users** → **Add user**:

```
Email:    owner@mizanora.tv      (apna email)
Password: (strong password — yaad rakhein)
```

### 1.3 Service account key (server ke liye)
Project settings (⚙️) → **Service accounts** → **Generate new private key** →
JSON file download hogi (`mizanora-tv-001-firebase-adminsdk-xxxx.json`).

⚠️ Ye file **kabhi** GitHub par push na karein. `.gitignore` me already blocked hai.

### 1.4 Firestore enable
Firestore Database → **Create database** → *Production mode* → region: `asia-south1` (ya nazdeeki).

### 1.5 Rules upload
```bash
npm i -g firebase-tools
firebase login
cd mizanora-tv/firebase
firebase use mizanora-tv-001
firebase deploy --only firestore:rules,firestore:indexes
```
Ya Firestore Console → Rules me `firebase/firestore.rules` ka content paste karke **Publish**.

---

## 2. Vercel deploy

```bash
cd mizanora-tv
npm i -g vercel
vercel
# ? Set up and deploy → yes
# ? Link to existing project? → no
# ? Project name → mizanora-tv
# ? Directory → ./  (enter)

vercel --prod      # production deploy
```

Aapko URL milega, jaise `https://mizanora-tv.vercel.app`.

---

## 3. Environment variables (sab se important step)

Vercel → Project → **Settings → Environment Variables** → *Production, Preview, Development* teeno select karein.

### 3.1 `FIREBASE_SERVICE_ACCOUNT`
Service account JSON file kholein, poora content **ek line** me copy karein:

```json
{"type":"service_account","project_id":"mizanora-tv-001","private_key_id":"abc123","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxx@mizanora-tv-001.iam.gserviceaccount.com","client_id":"123","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token"}
```

Bas yehi JSON value me paste kar dein (Vercel neline safe hai — code khud `\n` handle karta hai).

### 3.2 Baqi variables

| Key | Example | Note |
|---|---|---|
| `PUBLIC_BASE_URL` | `https://mizanora-tv.vercel.app` | playlist + stream URLs isi se bante hain |
| `PLAYLIST_TOKEN` | `mizanora-9f3a71c4d2-private` | private playlist secret — random rakhein |
| `STREAM_PROXY_SECRET` | `8f2k...` | signed links ka HMAC secret (optional, lekin recommended) |
| `GITHUB_TOKEN` | `github_pat_...` | GitHub fine-grained PAT → **Contents: Read and write** |
| `GITHUB_REPO` | `muaziqbal/mizanora-tv` | owner/repo |
| `GITHUB_BRANCH` | `main` | |
| `GITHUB_PATH` | `data/master.m3u` | |
| `FIREBASE_PROJECT_ID` | `mizanora-tv-001` | optional |

### 3.3 GitHub token banane ka tareeqa
GitHub → Settings → Developer settings → **Personal access tokens → Fine-grained tokens** →
*Generate new token*:
- Repository access → **Only select repositories** → `mizanora-tv`
- Permissions → Repository permissions → **Contents: Read and write**
- Generate → token copy (ek hi baar dikhta hai)

> Ye token sirf server par rehta hai. Browser me kabhi nahi aata. Agar token leak ho jaye to revoke kar dein.

**Redeploy** karein: Vercel → Deployments → ⋯ → *Redeploy*.

---

## 4. Pehli bar login (owner bootstrap)

1. `https://your-project.vercel.app/admin.html` kholein
2. Email + password (jo Firebase Auth me banaya) → **Login**
3. Pehla login karne wala user automatically **owner** ban jata hai
   (`admins/<uid>` doc create hota hai — sirf tab jab `admins` collection khali ho)
4. Dashboard par mode **LIVE • Firebase** dikhna chahiye

> Agar "not-admin" error aaye: Firestore → `admins` collection check karein.
> Manually add karna ho to doc ID = Firebase UID, fields: `{ role: "owner" }`.

---

## 5. Channels add karein

Admin → **Channels** → `+ Naya channel`:

| Field | Example |
|---|---|
| Name | `Mizanora One` |
| Category | `Entertainment` |
| Number | `1` |
| Logo URL | `https://.../logo.png` |
| m3u8 Server 1 | `https://server-a.com/live/one/index.m3u8` |
| m3u8 Server 2 | `https://server-b.com/live/one/index.m3u8` |
| m3u8 Server 3 | `https://server-c.com/live/one/index.m3u8` |

`⚡ Probe all servers` dabayein → har server ka ms dikhega → **Save**.

### Bulk import (JSON)
Channels page → *Bulk import* me:
```json
[
  {"name":"Mizanora One","category":"Entertainment","sources":["https://a/list.m3u8","https://b/list.m3u8"]},
  {"name":"News 24","category":"News","sources":["https://c/news.m3u8"]}
]
```

### Sample data se seed karna (optional)
```bash
export FIREBASE_SERVICE_ACCOUNT="$(cat serviceAccountKey.json)"
node scripts/seed.js data/channels.sample.json
```

---

## 6. Private playlist + GitHub publish

### Private playlist
Admin → **System / API** → `🔑 Private link` → `/m3u/<PLAYLIST_TOKEN>`.
Ye link **sirf aapko** dena hai. Bina token 403 milta hai.

### GitHub master.m3u
Admin → **GitHub Publish** → **Publish now**.

Output me commit SHA milega. Repo me `data/master.m3u` update ho jayegi — har channel ke
saare servers ke bajaye ek signed link, jo runtime par fastest server par resolve hota hai.

> Chahein to GitHub Action bhi use kar sakte hain: `.github/workflows/publish-m3u.yml`
> (manual trigger; aapke repo secrets me `PUBLIC_BASE_URL`, `STREAM_PROXY_SECRET` add karein).

---

## 7. Xtream users

Admin → **Xtream Users** → username/password + expiry + max connections → Save.

Player me:
```
Panel type : Xtream Codes API
Server URL : https://your-project.vercel.app
Port       : 443
Username   : (jo banaya)
Password   : (jo banaya)
```

M3U link:
```
https://your-project.vercel.app/get.php?username=USER&password=PASS&type=m3u_plus&output=m3u8
```

`Copy M3U` button users table me maujood hai.

---

## 8. Custom domain (optional)

Vercel → Settings → **Domains** → apna domain add karein → DNS me CNAME set karein.
Domain add karne ke baad **`PUBLIC_BASE_URL` update karein** (warna playlist URLs purane domain ke rahenge) → Redeploy.

---

## 9. Troubleshooting

| Problem | Hal |
|---|---|
| Home page "Demo mode" | `/api/channels` 503 → `FIREBASE_SERVICE_ACCOUNT` galat/missing. `/api/health` ke bajaye `/api/channels` browser me kholein — `detail` dekhein. |
| `private_key` error | JSON me `\n` escape ka masla. Value ko jaisa hai waisa paste karein (script khud replace karti hai). |
| Admin login "not-admin" | Firestore `admins` collection me apna UID add karein. |
| Stream 502 | Channel ke saare servers down ya m3u8 galat. Admin → Probe se check karein. |
| Stream chalti hai lekin segments fail | Upstream segments ko Referer chahiye — `_lib/hls.js` proxy Referer bhejta hai; agar koi custom header chahiye to channel ke source me `headers` field use karein. |
| Publish 401/404 | `GITHUB_TOKEN` scope ya `GITHUB_REPO` galat, ya branch/path exist nahi karta. |
| Playlist 403 | `/m3u/<token>` me token galat — `PLAYLIST_TOKEN` env se match karein. |

---

## 10. Post-deploy checklist

- [ ] `/api/channels` → `{"ok":true,"mode":"live"}`
- [ ] Home par channels dikh rahe hain aur play ho rahe hain
- [ ] Player me "Servers — fastest first" me ms values aa rahe hain
- [ ] `/admin.html` login + Dashboard "LIVE • Firebase"
- [ ] Private link `/m3u/<token>` khul raha hai
- [ ] Xtream user se TiviMate/Smarters me login
- [ ] GitHub publish → repo me `data/master.m3u`
- [ ] `legal.html`, `blog.html`, `about.html` khul rahe hain
- [ ] Mobile par bhi test (responsive)

---

**Developer:** Muaz Iqbal — Kasur, Pakistan · Mizanora TV © 2026
