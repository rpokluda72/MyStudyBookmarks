'use strict';

const fs = require('fs');

const SOURCE = process.argv[2] || 'bookmarks-source.json';
const DEST   = 'bookmarks.json';

function slugify(str) {
  return (str || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function detectLang(url) {
  return url.includes('.cz') ? 'cz' : 'en';
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
    const existing = JSON.parse(fs.readFileSync(DEST, 'utf8'));
    walk(existing.groups || []);
    console.log(`Preserved importances: ${itemImp.size} item(s), ${groupImp.size} group(s) from existing ${DEST}`);
  } catch { /* no existing file — use defaults */ }

  return { itemImp, groupImp };
}

const { itemImp, groupImp } = loadImportances();

function convertItem(node) {
  if (node.type !== 'text/x-moz-place' && node.typeCode !== 1) return null;
  const url = node.uri || '';
  if (!url || url.startsWith('place:')) return null;
  const title = (node.title || url).trim();
  return {
    id:         slugify(title) || slugify(url),
    title_en:   title,
    url,
    importance: itemImp.get(url) ?? 3,
    lang:       detectLang(url),
  };
}

function convertGroup(node) {
  const items  = [];
  const groups = [];

  for (const child of (node.children || [])) {
    if (child.type === 'text/x-moz-place-separator') continue;

    if (child.type === 'text/x-moz-place-container' || child.typeCode === 2) {
      const sub = convertGroup(child);
      if (sub) groups.push(sub);
    } else {
      const item = convertItem(child);
      if (item) items.push(item);
    }
  }

  const name = (node.title || 'Group').trim();
  return {
    id:         slugify(name) || 'group',
    name_en:    name,
    importance: groupImp.get(name) ?? 3,
    items,
    groups,
  };
}

const source = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));

// Source is either a top-level array or a single root container
const topNodes = Array.isArray(source) ? source : (source.children || []);

const topGroups  = [];
const looseItems = [];

for (const node of topNodes) {
  if (node.type === 'text/x-moz-place-separator') continue;

  if (node.type === 'text/x-moz-place-container' || node.typeCode === 2) {
    const group = convertGroup(node);
    if (group) topGroups.push(group);
  } else {
    const item = convertItem(node);
    if (item) looseItems.push(item);
  }
}

// Collect loose top-level bookmarks into an "Other" group
if (looseItems.length > 0) {
  topGroups.push({ id: 'other', name_en: 'Other', importance: groupImp.get('Other') ?? 3, items: looseItems, groups: [] });
}

const result = { groups: topGroups };

fs.writeFileSync(DEST, JSON.stringify(result, null, 2) + '\n', 'utf8');

console.log(`Written ${DEST} — ${topGroups.length} top-level group(s)`);
topGroups.forEach(g => {
  console.log(`  [${g.name_en}] ${g.items.length} item(s), ${g.groups.length} sub-group(s)`);
  g.groups.forEach(sg =>
    console.log(`    [${sg.name_en}] ${sg.items.length} item(s), ${sg.groups.length} sub-group(s)`)
  );
});
