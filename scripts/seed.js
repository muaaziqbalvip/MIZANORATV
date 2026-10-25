#!/usr/bin/env node
/**
 * Mizanora TV — Firestore seeder
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT='{...}' node scripts/seed.js [data/channels.sample.json]
 *
 * Ye script channels + default settings + ek xtream trial user create karta hai.
 */
const fs = require('fs');
const path = require('path');
let admin;
try {
  admin = require('firebase-admin');
} catch {
  console.error('✖ firebase-admin install karein: npm i firebase-admin');
  process.exit(1);
}

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) {
  console.error('✖ FIREBASE_SERVICE_ACCOUNT env missing (service account JSON).');
  process.exit(1);
}

const creds = JSON.parse(raw);
if (creds.private_key) creds.private_key = creds.private_key.replace(/\\n/g, '\n');
admin.initializeApp({ credential: admin.credential.cert(creds) });
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

async function main() {
  const file = process.argv[2] || path.join(__dirname, '..', 'data', 'channels.sample.json');
  const channels = JSON.parse(fs.readFileSync(file, 'utf8'));

  const batch = db.batch();
  channels.forEach((c) => {
    const id = c.id || c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    batch.set(db.collection('channels').doc(id), { ...c, id, createdAt: Date.now() }, { merge: true });
  });

  batch.set(
    db.collection('settings').doc('site'),
    {
      siteName: 'Mizanora TV',
      tagline: 'Fastest Streaming Engine • Zero Buffering',
      accent: '#22d3ee',
      logo: '/assets/img/logo.svg',
      email: 'contact@mizanora.tv',
      aboutText:
        'Mizanora TV ek self-hosted streaming system hai: multiple m3u8 servers, parallel latency probing, signed links aur instant failover.',
      adsEnabled: true,
      preRollSeconds: 5,
      streamTokenTtl: 43200,
      updatedAt: Date.now(),
    },
    { merge: true }
  );

  batch.set(
    db.collection('xtream_users').doc('trial-user'),
    {
      id: 'trial-user',
      username: 'trial',
      password: 'trial24',
      maxConnections: 1,
      expDate: Math.floor(Date.now() / 1000) + 86400 * 7,
      status: 'active',
      createdAt: Math.floor(Date.now() / 1000),
    },
    { merge: true }
  );

  await batch.commit();
  console.log(`✔ ${channels.length} channels + settings + trial user seed ho gaye.`);
  console.log('  Ab Firebase Console → Authentication me owner ka email/password user banayein,');
  console.log('  phir Admin panel se login karein (pehla user automatically owner ban jata hai).');
}

main().catch((e) => {
  console.error('✖ Seed fail:', e.message);
  process.exit(1);
});
