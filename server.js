'use strict';

const express = require('express');
const fs      = require('node:fs/promises');
const https   = require('node:https');
const http    = require('node:http');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

app.get('/api/links', async (req, res) => {
  try {
    res.json(JSON.parse(await fs.readFile('./bookmarks.json', 'utf8')));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/links', async (req, res) => {
  try {
    const data = req.body;
    await fs.writeFile('./bookmarks.json', JSON.stringify(data, null, 2) + '\n', 'utf8');
    res.json({ ok: true, linkTree: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function checkFrameHeaders(url, hopsLeft, res) {
  let parsed;
  try { parsed = new URL(url); } catch { return res.json({ canEmbed: true }); }

  const mod     = parsed.protocol === 'https:' ? https : http;
  const request = mod.request(
    {
      hostname: parsed.hostname,
      port:     parsed.port || undefined,
      path:     parsed.pathname + (parsed.search || ''),
      method:   'GET',
      headers:  {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept':     'text/html,application/xhtml+xml',
      },
      timeout: 6000,
    },
    response => {
      const status = response.statusCode;

      // Follow redirects
      if ([301, 302, 303, 307, 308].includes(status) && hopsLeft > 0) {
        const loc = response.headers['location'];
        response.destroy();
        if (loc) {
          const next = loc.startsWith('http') ? loc : new URL(loc, url).href;
          return checkFrameHeaders(next, hopsLeft - 1, res);
        }
      }

      const xfoRaw = response.headers['x-frame-options'];
      const xfo    = (Array.isArray(xfoRaw) ? xfoRaw.join(', ') : (xfoRaw || '')).toLowerCase();
      const csp    = response.headers['content-security-policy'] || '';
      const faMatch = csp.match(/frame-ancestors\s+([^;]+)/i);

      const blockedByXFO = /\b(deny|sameorigin)\b/.test(xfo);
      const blockedByCSP = faMatch ? !faMatch[1].includes('*') : false;

      response.destroy(); // drop body immediately
      res.json({ canEmbed: !(blockedByXFO || blockedByCSP) });
    },
  );

  request.on('error',   ()  => res.json({ canEmbed: true }));
  request.on('timeout', ()  => { request.destroy(); res.json({ canEmbed: true }); });
  request.end();
}

app.get('/api/check-frame', (req, res) => {
  const { url } = req.query;
  if (!url) return res.json({ canEmbed: true });
  checkFrameHeaders(url, 3, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MyStudyBookmarks running at http://localhost:${PORT}`));
