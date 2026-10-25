#!/usr/bin/env node
/**
 * Mizanora TV — self test (syntax + structure check, koi dependency nahi)
 * Usage: node scripts/self-test.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
let pass = 0;
let fail = 0;

function ok(msg) {
  pass++;
  console.log('  ✔ ' + msg);
}
function bad(msg) {
  fail++;
  console.log('  ✖ ' + msg);
}

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.vercel', 'dist'].includes(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

const files = walk(root);

console.log('\n▶ JS syntax check');
files
  .filter((f) => f.endsWith('.js') && !f.includes('/public/assets/js/'))
  .forEach((f) => {
    try {
      execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
      ok(path.relative(root, f));
    } catch (e) {
      bad(path.relative(root, f) + ' → ' + String(e.stderr || e.message).split('\n')[0]);
    }
  });

console.log('\n▶ Browser JS syntax check');
files
  .filter((f) => f.includes('/public/assets/js/') && f.endsWith('.js'))
  .forEach((f) => {
    try {
      execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
      ok(path.relative(root, f));
    } catch (e) {
      bad(path.relative(root, f) + ' → ' + String(e.stderr || e.message).split('\n')[0]);
    }
  });

console.log('\n▶ JSON validity');
files
  .filter((f) => f.endsWith('.json') && !f.includes('node_modules'))
  .forEach((f) => {
    try {
      JSON.parse(fs.readFileSync(f, 'utf8'));
      ok(path.relative(root, f));
    } catch (e) {
      bad(path.relative(root, f) + ' → ' + e.message);
    }
  });

console.log('\n▶ Required files');
[
  'public/index.html',
  'public/admin.html',
  'public/blog.html',
  'public/about.html',
  'public/legal.html',
  'public/assets/css/app.css',
  'public/assets/js/app.js',
  'public/assets/js/admin.js',
  'api/channels.js',
  'api/stream.js',
  'api/proxy.js',
  'api/health.js',
  'api/playlist.js',
  'api/posts.js',
  'api/xtream/player_api.php.js',
  'api/xtream/get.php.js',
  'api/xtream/xmltv.php.js',
  'api/live/[...path].js',
  'api/github/publish.js',
  'api/admin/playlist.js',
  'vercel.json',
  'firebase/firestore.rules',
].forEach((f) => (fs.existsSync(path.join(root, f)) ? ok(f) : bad('missing: ' + f)));

console.log('\n▶ Signing roundtrip');
try {
  const { streamToken, verify } = require(path.join(root, 'api', '_lib', 'sign.js'));
  const t = streamToken('demo-1', 60);
  const v = verify(t);
  v && v.id === 'demo-1' ? ok('HMAC token sign/verify') : bad('token verify fail');
  verify('tampered.token') === null ? ok('tampered token reject') : bad('tampered token accepted!');
} catch (e) {
  bad('sign.js: ' + e.message);
}

console.log('\n▶ HLS rewriter');
try {
  const { rewriteManifest } = require(path.join(root, 'api', '_lib', 'hls.js'));
  const src = '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXTINF:6,\nseg1.ts\n';
  const out = rewriteManifest(src, 'https://cdn.example.com/live/index.m3u8', (u) => `/p/x?u=${encodeURIComponent(u)}`);
  out.includes('/p/x') && out.includes('seg1.ts') ? ok('manifest rewrite') : bad('manifest rewrite fail: ' + out);
} catch (e) {
  bad('hls.js: ' + e.message);
}

console.log(`\n──────────────────────────────\n  PASS: ${pass}   FAIL: ${fail}\n`);
process.exit(fail ? 1 : 0);
