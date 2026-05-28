'use strict';

const fs = require('fs');

const SOURCE = process.argv[2] || 'bookmarks-source.html';
let html = fs.readFileSync(SOURCE, 'utf8');

// Strip huge base64 icon data so regexes run fast
html = html.replace(/\s+ICON="data:[^"]*"/g, '');
html = html.replace(/\s+ICON_URI="[^"]*"/g, '');

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/* ── Load importance values from existing bookmarks.json ── */
function loadImportances() {
  const itemImp  = new Map(); // url → importance
  const groupImp = new Map(); // name_en → importance

  function walk(groups) {
    for (const g of groups) {
      if (g.importance != null) groupImp.set(g.name_en, g.importance);
      for (const item of (g.items || [])) {
        if (item.url && item.importance != null) itemImp.set(item.url, item.importance);
      }
      walk(g.groups || []);
    }
  }

  try {
    const existing = JSON.parse(fs.readFileSync('bookmarks.json', 'utf8'));
    walk(existing.groups || []);
    console.log(`Preserved importances: ${itemImp.size} item(s), ${groupImp.size} group(s) from existing bookmarks.json`);
  } catch { /* no existing file — use defaults */ }

  return { itemImp, groupImp };
}

const { itemImp, groupImp } = loadImportances();

function tokenise(html) {
  const tokens = [];
  const re = /<H3[^>]*>([\s\S]*?)<\/H3>|<A HREF="([^"]*)"[^>]*>([\s\S]*?)<\/A>|<DL>|<\/DL>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[0];
    if (raw.startsWith('<DL')) {
      tokens.push({ type: 'dl-open' });
    } else if (raw.startsWith('</DL')) {
      tokens.push({ type: 'dl-close' });
    } else if (raw.startsWith('<H3')) {
      tokens.push({ type: 'h3', name: m[1].replace(/<[^>]+>/g, '').trim() });
    } else {
      const url   = m[2];
      const title = m[3].replace(/<[^>]+>/g, '').trim();
      if (url && !url.startsWith('place:')) {
        tokens.push({ type: 'a', url, title });
      }
    }
  }
  return tokens;
}

function parseLevel(tokens, pos) {
  const items  = [];
  const groups = [];

  while (pos < tokens.length) {
    const tok = tokens[pos];

    if (tok.type === 'dl-close') {
      return { items, groups, nextPos: pos + 1 };
    }

    if (tok.type === 'a') {
      items.push({
        id:         slugify(tok.title) || slugify(tok.url),
        title_en:   tok.title,
        url:        tok.url,
        importance: itemImp.get(tok.url) ?? 3,
        lang:       tok.url.includes('.cz') ? 'cz' : 'en',
      });
      pos++;
      continue;
    }

    if (tok.type === 'h3') {
      const name = tok.name;
      pos++;
      if (pos < tokens.length && tokens[pos].type === 'dl-open') {
        pos++;
        const child = parseLevel(tokens, pos);
        pos = child.nextPos;
        groups.push({
          id:         slugify(name) || 'group',
          name_en:    name,
          importance: groupImp.get(name) ?? 3,
          items:      child.items,
          groups:     child.groups,
        });
      } else {
        groups.push({ id: slugify(name) || 'group', name_en: name, importance: groupImp.get(name) ?? 3, items: [], groups: [] });
      }
      continue;
    }

    if (tok.type === 'dl-open') { pos++; continue; }
    pos++;
  }

  return { items, groups, nextPos: pos };
}

const tokens = tokenise(html);
const root   = parseLevel(tokens, 0);

let topGroups = root.groups;
if (topGroups.length === 1 && topGroups[0].items.length === 0) {
  const wrapper = topGroups[0];
  topGroups = wrapper.groups;
  if (wrapper.items.length > 0) {
    topGroups.push({ id: 'other', name_en: 'Other', importance: groupImp.get('Other') ?? 3, items: wrapper.items, groups: [] });
  }
}

if (root.items.length > 0) {
  topGroups.push({ id: 'other', name_en: 'Other', importance: groupImp.get('Other') ?? 3, items: root.items, groups: [] });
}

const result = { groups: topGroups };

fs.writeFileSync('bookmarks.json', JSON.stringify(result, null, 2) + '\n', 'utf8');

console.log(`Written bookmarks.json — ${topGroups.length} top-level groups`);
topGroups.forEach(g => {
  console.log(`  [${g.name_en}] ${g.items.length} items, ${g.groups.length} sub-groups`);
  g.groups.forEach(sg => console.log(`    [${sg.name_en}] ${sg.items.length} items, ${sg.groups.length} sub-groups`));
});
