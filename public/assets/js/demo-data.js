/* Mizanora TV — Demo data (jab /api/channels available na ho: local preview / static hosting)
   Demo streams public test HLS hain — sirf demo mode ke liye. */
(function () {
  function logo(text, c1, c2) {
    const initials = text
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
      <rect width="200" height="120" rx="16" fill="#0b1120"/>
      <circle cx="160" cy="18" r="46" fill="url(#g)" opacity="0.35"/>
      <text x="100" y="62" font-family="Segoe UI,Arial" font-size="40" font-weight="800"
            fill="url(#g)" text-anchor="middle" dominant-baseline="middle">${initials}</text>
      <text x="100" y="92" font-family="Segoe UI,Arial" font-size="11" letter-spacing="2.4"
            fill="#8ea0c0" text-anchor="middle">${text.toUpperCase().slice(0, 18)}</text>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  const S = {
    mux: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    apple: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
    akamai: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8',
    sintel: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
    tears: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
  };

  const groups = [
    ['Mizanora One', 'Entertainment', '#22d3ee', '#a78bfa', [S.mux, S.apple, S.akamai]],
    ['Prime Sports HD', 'Sports', '#34d399', '#22d3ee', [S.akamai, S.sintel]],
    ['Cine Gold', 'Movies', '#f472b6', '#a78bfa', [S.sintel, S.mux]],
    ['News 24 Urdu', 'News', '#fbbf24', '#fb7185', [S.apple, S.tears]],
    ['Kids Planet', 'Kids', '#60a5fa', '#34d399', [S.tears, S.mux]],
    ['Music Vibes', 'Music', '#c084fc', '#22d3ee', [S.mux, S.sintel]],
    ['Documentary Hub', 'Documentary', '#2dd4bf', '#60a5fa', [S.apple, S.akamai]],
    ['Islamic TV', 'Religious', '#34d399', '#fbbf24', [S.tears, S.apple]],
    ['Mizanora Sports 2', 'Sports', '#fb7185', '#fbbf24', [S.sintel, S.akamai]],
    ['Family Drama', 'Entertainment', '#a78bfa', '#f472b6', [S.mux, S.tears]],
    ['Tech & Science', 'Documentary', '#38bdf8', '#a78bfa', [S.apple, S.mux]],
    ['Lollywood Classics', 'Movies', '#f97316', '#fbbf24', [S.sintel, S.tears]],
  ];

  const channels = groups.map((g, i) => {
    const [name, category, c1, c2, srcs] = g;
    return {
      id: 'demo-' + (i + 1),
      name,
      category,
      number: i + 1,
      logo: logo(name, c1, c2),
      epg: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: `${name} — live 24/7. Fastest-server engine demo channel.`,
      quality: i % 3 === 0 ? 'FHD' : 'HD',
      language: 'Urdu / English',
      featured: i < 4,
      sources: srcs.map((url, k) => ({ url, label: `Server ${k + 1}`, priority: k, enabled: true })),
    };
  });

  window.MIZANORA_DEMO = {
    ok: true,
    mode: 'demo',
    generatedAt: Date.now(),
    settings: {
      siteName: 'Mizanora TV',
      tagline: 'Fastest Streaming Engine • Zero Buffering',
      logo: '/assets/img/logo.svg',
      accent: '#22d3ee',
      aboutText:
        'Mizanora TV ek self-hosted streaming system hai: multiple m3u8 servers, parallel latency probing, signed links aur instant failover.',
      telegram: 'https://t.me/',
      whatsapp: '',
      email: 'contact@mizanora.tv',
      ads: { enabled: true, preRollSeconds: 5, banner: '', bannerLink: '' },
    },
    categories: [...new Set(channels.map((c) => c.category))],
    total: channels.length,
    channels,
  };
})();
