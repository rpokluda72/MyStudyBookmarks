'use strict';

const fs    = require('node:fs');
const https = require('node:https');
const http  = require('node:http');

/* ── Collect unique hostnames from bookmark tree ───────── */
function collectHostnames(groups, set = new Set()) {
  for (const g of groups) {
    for (const item of (g.items || [])) {
      try { set.add(new URL(item.url).hostname); } catch { /* skip invalid */ }
    }
    collectHostnames(g.groups || [], set);
  }
  return set;
}

/* ── Check one hostname for X-Frame-Options (with redirects) ── */
function checkHostname(hostname, hopsLeft = 3) {
  return new Promise(resolve => {
    let url;
    try { url = new URL(`https://${hostname}/`); } catch { return resolve(true); }

    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request(
      {
        hostname: url.hostname,
        path:     '/',
        method:   'GET',
        headers:  {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
        timeout: 7000,
      },
      response => {
        const status = response.statusCode;

        if ([301, 302, 303, 307, 308].includes(status) && hopsLeft > 0) {
          const loc = response.headers['location'];
          response.destroy();
          if (loc) {
            try {
              const next = new URL(loc.startsWith('http') ? loc : `https://${hostname}${loc}`);
              return checkHostname(next.hostname, hopsLeft - 1).then(resolve);
            } catch { return resolve(true); }
          }
        }

        const xfoRaw  = response.headers['x-frame-options'];
        const xfo     = (Array.isArray(xfoRaw) ? xfoRaw.join(', ') : (xfoRaw || '')).toLowerCase();
        const csp     = response.headers['content-security-policy'] || '';
        const faMatch = csp.match(/frame-ancestors\s+([^;]+)/i);

        const blockedByXFO = /\b(deny|sameorigin)\b/.test(xfo);
        const blockedByCSP = faMatch ? !faMatch[1].includes('*') : false;

        response.destroy();
        resolve(!(blockedByXFO || blockedByCSP));
      },
    );

    req.on('error',   ()  => resolve(true));
    req.on('timeout', ()  => { req.destroy(); resolve(true); });
    req.end();
  });
}

/* ── Main ──────────────────────────────────────────────── */
async function main() {
  const data = JSON.parse(fs.readFileSync('bookmarks.json', 'utf8'));
  let   html = fs.readFileSync('index.html', 'utf8');
  const css  = fs.readFileSync('style.css',  'utf8');
  const js   = fs.readFileSync('app.js',     'utf8');

  const hostnames = [...collectHostnames(data.groups || [])];
  console.log(`Checking ${hostnames.length} hostname(s) for iframe restrictions…`);

  const results = await Promise.all(
    hostnames.map(async h => ({ hostname: h, canEmbed: await checkHostname(h) }))
  );

  const blocked = results.filter(r => !r.canEmbed).map(r => r.hostname);
  if (blocked.length) {
    console.log(`Blocked: ${blocked.join(', ')}`);
  } else {
    console.log('No blocked hostnames found.');
  }

  const injectedData = [
    `<script>window.LINK_TREE = ${JSON.stringify(data, null, 2)};</script>`,
    blocked.length
      ? `<script>window.FRAME_BLOCKED_HOSTNAMES = ${JSON.stringify(blocked)};</script>`
      : '',
  ].filter(Boolean).join('\n');

  // Inline CSS and JS so static.html is fully self-contained
  html = html
    .replace('<link rel="stylesheet" href="style.css">', `<style>\n${css}\n</style>`)
    .replace('<script src="app.js"></script>', `<script>\n${js}\n</script>`)
    .replace('<body>', '<body data-static="true">')
    .replace('</body>', injectedData + '\n</body>');

  fs.writeFileSync('static.html', html, 'utf8');
  console.log('Generated static.html');
}

main().catch(err => { console.error(err); process.exit(1); });
