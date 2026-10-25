#!/usr/bin/env node
/**
 * Mizanora TV — master.m3u generator (local / CI)
 *
 * Usage:
 *   PUBLIC_BASE_URL=https://your-domain.vercel.app \
 *   STREAM_PROXY_SECRET=super-secret \
 *   node scripts/make-master-m3u.js data/channels.sample.json > data/master.m3u
 *
 * Har channel ke saare servers playlist me comment ke tor par note hote hain,
 * lekin playable URL sirf signed /s/<token>/index.m3u8 hota hai — engine
 * runtime par fastest server khud chunta hai.
 */
const fs = require('fs');
const path = require('path');
const { streamToken } = require(path.join(__dirname, '..', 'api', '_lib', 'sign.js'));

const base = (process.env.PUBLIC_BASE_URL || 'https://mizanora-tv.vercel.app').replace(/\/$/, '');
const ttl = Number(process.env.STREAM_TOKEN_TTL || 43200);
const file = process.argv[2] || path.join(__dirname, '..', 'data', 'channels.sample.json');

const channels = JSON.parse(fs.readFileSync(file, 'utf8')).filter((c) => c.enabled !== false);

const out = ['#EXTM3U', `#PLAYLIST:Mizanora TV — generated ${new Date().toISOString()}`, '#EXTVLCOPT:http-user-agent=MizanoraTV/1.0'];

channels
  .sort((a, b) => (a.number || 9999) - (b.number || 9999))
  .forEach((c) => {
    const id = c.id || c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const epg = c.epg || id;
    out.push(
      `#EXTINF:-1 tvg-id="${epg}" tvg-name="${c.name}" tvg-logo="${c.logo || ''}" group-title="${c.category || 'General'}",${c.name}`
    );
    out.push(`# Mizanora: ${(c.sources || []).length} servers (fastest auto-selected)`);
    out.push(`${base}/s/${streamToken(id, ttl)}/index.m3u8`);
  });

const text = out.join('\n') + '\n';

const outFile = process.argv[3];
if (outFile) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, text);
  console.error(`✔ master.m3u likhi gayi: ${outFile} (${channels.length} channels)`);
} else {
  process.stdout.write(text);
}
