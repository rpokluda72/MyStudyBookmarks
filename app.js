/* ═══════════════════════════════════════════════════════
   MyStudyBookmarks — app.js
   ═══════════════════════════════════════════════════════ */

'use strict';

/* ── Constants ─────────────────────────────────────────── */
const DEFAULT_IMPORTANCE_COLORS = {
  '1': '#ef4444',
  '2': '#eab308',
  '3': '#3b82f6',
  '4': '#22c55e',
  '5': '#94a3b8',
};

const IMPORTANCE_NAMES = {
  '1': 'Essential',
  '2': 'Important',
  '3': 'Useful',
  '4': 'Optional',
  '5': 'Archive',
};

/* ── State ─────────────────────────────────────────────── */
let currentUrl   = null;
let currentImp   = 3;
let sidebarQuery = '';
let langFilter   = 'all';
let impFilter    = (() => {
  try {
    const s = localStorage.getItem('msb_imp_filter');
    return s ? new Set(JSON.parse(s)) : new Set([1,2,3,4,5]);
  } catch { return new Set([1,2,3,4,5]); }
})();

function saveImpFilter() {
  localStorage.setItem('msb_imp_filter', JSON.stringify([...impFilter]));
}

/* ── Importance Colors ─────────────────────────────────── */
function getImportanceColors() {
  try {
    const saved = localStorage.getItem('msb_importance_colors');
    return saved ? { ...DEFAULT_IMPORTANCE_COLORS, ...JSON.parse(saved) } : { ...DEFAULT_IMPORTANCE_COLORS };
  } catch { return { ...DEFAULT_IMPORTANCE_COLORS }; }
}

function saveImportanceColors(colors) {
  localStorage.setItem('msb_importance_colors', JSON.stringify(colors));
  applyCssVars(colors);
}

function applyCssVars(colors) {
  const root = document.documentElement;
  for (let i = 1; i <= 5; i++) {
    root.style.setProperty(`--importance-${i}-color`, colors[String(i)] || DEFAULT_IMPORTANCE_COLORS[String(i)]);
  }
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function impLightBg(hex) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.round(r+(255-r)*0.88)},${Math.round(g+(255-g)*0.88)},${Math.round(b+(255-b)*0.88)})`;
}

/* ── Open Mode ─────────────────────────────────────────── */
function getOpenMode() {
  return localStorage.getItem('msb_open_mode') || 'iframe';
}

function applyOpenMode(mode) {
  const btn = document.getElementById('open-mode-btn');
  if (mode === 'iframe') {
    btn.innerHTML = '&#9634; Inline';
    btn.title = 'Links open inline — click to switch to new tab';
  } else {
    btn.innerHTML = '&#128279; Tab';
    btn.title = 'Links open in new tab — click to switch to inline';
  }
}

document.getElementById('open-mode-btn').addEventListener('click', () => {
  const newMode = getOpenMode() === 'iframe' ? 'tab' : 'iframe';
  localStorage.setItem('msb_open_mode', newMode);
  applyOpenMode(newMode);
});

/* ── Helpers ───────────────────────────────────────────── */
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/* ── Sidebar ───────────────────────────────────────────── */
function renderGroup(group, depth, parentPath) {
  const catPath   = [...parentPath, group.id].join('/');
  const saved     = localStorage.getItem(`msb_cat_${catPath}`);
  const isOpen    = saved === null ? false : saved === 'true';
  const imp       = group.importance || 3;
  const groupPath = [...parentPath, group.id];

  const subGroups = (group.groups || [])
    .map(g => renderGroup(g, depth + 1, groupPath))
    .join('');

  const items = (group.items || []).map(item => {
    const iImp   = item.importance || 3;
    const iLang  = item.lang || 'en';
    const active = item.url === currentUrl ? ' active' : '';
    const czBadge = iLang === 'cz' ? '<span class="lang-badge">CZ</span>' : '';
    return `<li>
      <a href="#" data-url="${escHtml(item.url)}" data-title="${escHtml(item.title_en)}"
         data-imp="${iImp}" data-lang="${iLang}"
         class="bookmark-link${active}" style="--item-color:var(--importance-${iImp}-color)" title="${escHtml(item.url)}">
        ${escHtml(item.title_en)}${czBadge}
      </a>
    </li>`;
  }).join('');

  const czCount  = countCzLinks(group);
  const czBadgeG = czCount > 0 ? `<span class="lang-badge">CZ ${czCount}</span>` : '';

  return `<details class="category" data-cat-path="${catPath}" style="--cat-depth:${depth};--item-color:var(--importance-${imp}-color)" ${isOpen ? 'open' : ''}>
    <summary>
      <span class="cat-name">${escHtml(group.name_en)}</span>
      ${renderImpDots(group)}
      ${czBadgeG}
    </summary>
    ${subGroups}
    ${items ? `<ul>${items}</ul>` : ''}
  </details>`;
}

function buildSidebar() {
  const nav  = document.getElementById('sidebar');
  const tree = window.LINK_TREE || { groups: [] };

  nav.innerHTML = `<div class="sidebar-toolbar">
    <div class="sidebar-search">
      <input type="text" id="sidebar-search-input" placeholder="Filter bookmarks…" value="${sidebarQuery.replace(/"/g, '&quot;')}">
      <button id="sidebar-search-clear" class="ss-btn" title="Clear" ${sidebarQuery ? '' : 'hidden'}>&#10005;</button>
    </div>
    <div class="sidebar-lang-filter">
      <button class="lang-filter-btn${langFilter === 'all' ? ' active' : ''}" data-lang="all">All</button>
      <button class="lang-filter-btn${langFilter === 'en'  ? ' active' : ''}" data-lang="en">EN</button>
      <button class="lang-filter-btn${langFilter === 'cz'  ? ' active' : ''}" data-lang="cz">CZ</button>
    </div>
    <div class="sidebar-imp-filter">
      ${[1,2,3,4,5].map(i => `<button class="imp-filter-btn${impFilter.has(i) ? ' active' : ''}" data-imp="${i}" style="--imp-color:var(--importance-${i}-color)" title="${i} – ${IMPORTANCE_NAMES[String(i)]}">${i}</button>`).join('')}
    </div>
    <button id="collapse-all-btn">&#8855; Collapse all</button>
  </div>` + tree.groups.map(g => renderGroup(g, 0, [])).join('');

  nav.querySelectorAll('details.category').forEach(el => {
    el.addEventListener('toggle', () => {
      localStorage.setItem(`msb_cat_${el.dataset.catPath}`, el.open);
      updateCollapseAllBtn();
    });
  });

  document.getElementById('collapse-all-btn').addEventListener('click', () => {
    const details = nav.querySelectorAll('details.category:not([hidden])');
    const anyOpen = [...details].some(d => d.open);
    details.forEach(d => {
      d.open = !anyOpen;
      localStorage.setItem(`msb_cat_${d.dataset.catPath}`, !anyOpen);
    });
    updateCollapseAllBtn();
  });

  document.getElementById('sidebar-search-input').addEventListener('input', e => {
    sidebarQuery = e.target.value;
    filterSidebar(sidebarQuery);
  });

  document.getElementById('sidebar-search-clear').addEventListener('click', () => {
    sidebarQuery = '';
    document.getElementById('sidebar-search-input').value = '';
    filterSidebar('');
    document.getElementById('sidebar-search-input').focus();
  });

  nav.querySelectorAll('.lang-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      langFilter = btn.dataset.lang;
      nav.querySelectorAll('.lang-filter-btn').forEach(b => b.classList.toggle('active', b === btn));
      filterSidebar(sidebarQuery);
    });
  });

  nav.querySelectorAll('.imp-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const level = parseInt(btn.dataset.imp, 10);
      if (impFilter.has(level)) impFilter.delete(level);
      else impFilter.add(level);
      saveImpFilter();
      btn.classList.toggle('active', impFilter.has(level));
      filterSidebar(sidebarQuery);
    });
  });

  if (sidebarQuery || langFilter !== 'all' || impFilter.size < 5) filterSidebar(sidebarQuery);
  updateCollapseAllBtn();
}

function filterSidebar(query) {
  const nav = document.getElementById('sidebar');
  const q   = query.trim().toLowerCase();
  const filtering = q || langFilter !== 'all' || impFilter.size < 5;

  // Snapshot open states before any DOM changes — filter must never alter expand/collapse
  const allDetails = [...nav.querySelectorAll('details.category')];
  const openStates = filtering ? new Map(allDetails.map(d => [d, d.open])) : null;

  allDetails.forEach(group => {
    let anyVisible = false;
    group.querySelectorAll('li').forEach(li => {
      const a         = li.querySelector('.bookmark-link');
      const textMatch = !q || li.textContent.toLowerCase().includes(q);
      const langMatch = langFilter === 'all' || (a && a.dataset.lang === langFilter);
      const impMatch  = impFilter.size === 5 || (a && impFilter.has(parseInt(a.dataset.imp || '3', 10)));
      const match     = textMatch && langMatch && impMatch;
      li.hidden = !match;
      if (match) anyVisible = true;
    });
    if (filtering) {
      group.hidden = !anyVisible;
    } else {
      group.hidden = false;
      const saved = localStorage.getItem(`msb_cat_${group.dataset.catPath}`);
      const depth = parseInt(group.style.getPropertyValue('--cat-depth') || '0', 10);
      group.open  = saved === null ? (depth === 0) : saved === 'true';
    }
  });

  // Restore open states — toggling hidden on <details> can cause the browser to change .open
  if (openStates) {
    openStates.forEach((wasOpen, el) => { if (el.open !== wasOpen) el.open = wasOpen; });
  }

  const clearBtn = document.getElementById('sidebar-search-clear');
  if (clearBtn) clearBtn.hidden = !q;
  updateCollapseAllBtn();
}

function updateCollapseAllBtn() {
  const btn = document.getElementById('collapse-all-btn');
  if (!btn) return;
  const anyOpen = [...document.querySelectorAll('details.category')].some(d => d.open);
  btn.innerHTML = anyOpen ? '&#8855; Collapse all' : '&#8862; Expand all';
}

function updateActiveLink(url) {
  document.querySelectorAll('.bookmark-link').forEach(a => {
    a.classList.toggle('active', a.dataset.url === url);
  });
}

/* ── Tree Helpers ──────────────────────────────────────── */
function findItemByUrl(url, groups) {
  for (const group of groups) {
    const items = group.items || [];
    const idx   = items.findIndex(it => it.url === url);
    if (idx !== -1) return { item: items[idx], items, index: idx };
    const found = findItemByUrl(url, group.groups || []);
    if (found) return found;
  }
  return null;
}

async function saveTree() {
  if (!window.LINK_TREE) return;
  try {
    const res  = await fetch('/api/links', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(window.LINK_TREE),
    });
    const json = await res.json();
    if (res.ok) window.LINK_TREE = json.linkTree;
  } catch { /* static mode — ignore */ }
  buildSidebar();
}

function updateInfoBarImpStyle(level) {
  const color = getImportanceColors()[String(level)] || DEFAULT_IMPORTANCE_COLORS['3'];
  document.getElementById('content-info-bar').style.setProperty('--info-imp-color', color);
}

/* ── Frame-embed Check ─────────────────────────────────── */
const frameCheckCache = new Map(); // hostname → canEmbed

async function canEmbedUrl(url) {
  try {
    const { hostname } = new URL(url);
    if (frameCheckCache.has(hostname)) return frameCheckCache.get(hostname);

    let canEmbed;
    if (document.body.dataset.static) {
      // Static mode: use list pre-computed by generate-static.js
      canEmbed = !(window.FRAME_BLOCKED_HOSTNAMES || []).includes(hostname);
    } else {
      const res = await fetch(`/api/check-frame?url=${encodeURIComponent(url)}`);
      canEmbed  = (await res.json()).canEmbed;
    }

    frameCheckCache.set(hostname, canEmbed);
    return canEmbed;
  } catch {
    return true;
  }
}

/* ── Link Loading ──────────────────────────────────────── */
async function openBookmark(url, title, imp) {
  if (getOpenMode() === 'tab') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  currentUrl = url;
  currentImp = imp;

  const colors   = getImportanceColors();
  const impColor = colors[String(imp)] || DEFAULT_IMPORTANCE_COLORS['3'];
  const welcome  = document.getElementById('welcome-screen');
  const iframe   = document.getElementById('content-iframe');
  const infoBar  = document.getElementById('content-info-bar');
  const blocked  = document.getElementById('iframe-blocked-notice');

  welcome.hidden = true;
  infoBar.hidden = false;
  iframe.hidden  = true;
  blocked.hidden = true;
  iframe.src     = '';

  infoBar.style.borderBottomColor = impColor;
  infoBar.style.backgroundColor   = impLightBg(impColor);
  document.getElementById('info-bar-title').value = title || url;
  autoSizeInfoBarTitle();
  document.getElementById('info-bar-imp').value   = String(imp);
  updateInfoBarImpStyle(imp);
  const urlEl = document.getElementById('info-bar-url');
  urlEl.textContent = url;
  urlEl.href        = url;

  updateActiveLink(url);

  const canEmbed = await canEmbedUrl(url);
  if (currentUrl !== url) return; // user clicked another link while checking

  if (canEmbed) {
    iframe.hidden = false;
    iframe.src    = url;
  } else {
    blocked.hidden = false;
  }
}

/* ── Click Delegation ──────────────────────────────────── */
document.addEventListener('click', e => {
  const link = e.target.closest('[data-url]');
  if (!link) return;
  e.preventDefault();
  openBookmark(link.dataset.url, link.dataset.title, parseInt(link.dataset.imp || '3', 10));
  document.getElementById('sidebar').classList.remove('open');
});

/* ── Sidebar Toggle ────────────────────────────────────── */
document.getElementById('sidebar-toggle').addEventListener('click', () => {
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.toggle('open');
  } else {
    const collapsed = document.getElementById('layout').classList.toggle('sidebar-collapsed');
    localStorage.setItem('msb_sidebar', collapsed ? '0' : '1');
  }
});

/* ── Info Bar ──────────────────────────────────────────── */
const _titleSizer = document.createElement('span');
Object.assign(_titleSizer.style, {
  position: 'fixed', top: '0', left: '-9999px',
  visibility: 'hidden', whiteSpace: 'pre', pointerEvents: 'none',
});
document.body.appendChild(_titleSizer);

function autoSizeInfoBarTitle() {
  const input = document.getElementById('info-bar-title');
  const cs    = getComputedStyle(input);
  _titleSizer.style.font          = cs.font;
  _titleSizer.style.letterSpacing = cs.letterSpacing;
  _titleSizer.style.padding       = cs.padding;
  _titleSizer.textContent         = input.value || '';
  const contentW = _titleSizer.offsetWidth + 8;
  const bar      = document.getElementById('content-info-bar');
  const maxW     = bar.offsetWidth ? Math.floor(bar.offsetWidth * 0.72) : 600;
  input.style.width = Math.max(80, Math.min(contentW, maxW)) + 'px';
}

document.getElementById('info-bar-title').addEventListener('input', autoSizeInfoBarTitle);

document.getElementById('info-bar-new-tab').addEventListener('click', () => {
  if (currentUrl) window.open(currentUrl, '_blank', 'noopener,noreferrer');
});

document.getElementById('blocked-open-tab').addEventListener('click', () => {
  if (currentUrl) window.open(currentUrl, '_blank', 'noopener,noreferrer');
});

document.getElementById('info-bar-title').addEventListener('keydown', e => {
  if (e.key === 'Enter') e.target.blur();
});

document.getElementById('info-bar-title').addEventListener('blur', async () => {
  const input    = document.getElementById('info-bar-title');
  const newTitle = input.value.trim();
  if (!newTitle || !currentUrl || !window.LINK_TREE) return;
  const found = findItemByUrl(currentUrl, window.LINK_TREE.groups);
  if (!found || found.item.title_en === newTitle) return;
  found.item.title_en = newTitle;
  await saveTree();
});

document.getElementById('info-bar-imp').addEventListener('change', async e => {
  const level    = parseInt(e.target.value, 10);
  currentImp     = level;
  const impColor = getImportanceColors()[String(level)] || DEFAULT_IMPORTANCE_COLORS['3'];
  const infoBar  = document.getElementById('content-info-bar');
  infoBar.style.borderBottomColor = impColor;
  infoBar.style.backgroundColor   = impLightBg(impColor);
  updateInfoBarImpStyle(level);
  if (!currentUrl || !window.LINK_TREE) return;
  const found = findItemByUrl(currentUrl, window.LINK_TREE.groups);
  if (!found) return;
  found.item.importance = level;
  await saveTree();
});

document.getElementById('info-bar-delete').addEventListener('click', async () => {
  if (!currentUrl || !window.LINK_TREE) return;
  const title = document.getElementById('info-bar-title').value || currentUrl;
  if (!confirm(`Delete "${title}"?`)) return;
  const found = findItemByUrl(currentUrl, window.LINK_TREE.groups);
  if (!found) return;
  found.items.splice(found.index, 1);
  currentUrl = null;
  document.getElementById('content-info-bar').hidden    = true;
  document.getElementById('content-iframe').hidden      = true;
  document.getElementById('iframe-blocked-notice').hidden = true;
  document.getElementById('welcome-screen').hidden      = false;
  await saveTree();
});

/* ── Keyboard Shortcuts ────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.getElementById('sidebar').classList.remove('open');
});

/* ── Manage Dialog ─────────────────────────────────────── */
let mgData = null;

function getGroupByPath(path) {
  let groups = mgData.groups;
  let group;
  for (const idx of path.split('.').map(Number)) {
    group  = groups[idx];
    groups = group.groups || [];
  }
  return group;
}

function countCzLinks(group) {
  let n = 0;
  for (const item of (group.items || [])) {
    if ((item.lang || 'en') === 'cz') n++;
  }
  for (const sub of (group.groups || [])) n += countCzLinks(sub);
  return n;
}

function countImportances(group) {
  const counts = {};
  for (const item of (group.items || [])) {
    const l = item.importance || 3;
    counts[l] = (counts[l] || 0) + 1;
  }
  for (const sub of (group.groups || [])) {
    for (const [k, v] of Object.entries(countImportances(sub)))
      counts[k] = (counts[k] || 0) + v;
  }
  return counts;
}

function renderImpDots(group) {
  const colors = getImportanceColors();
  const counts = countImportances(group);
  if (!Object.keys(counts).length) return '';
  let html = '';
  for (let i = 1; i <= 5; i++) {
    const n = counts[i];
    if (!n) continue;
    const color = colors[String(i)];
    html += `<span class="mg-imp-dot-entry" title="${n} × Importance ${i} – ${IMPORTANCE_NAMES[String(i)]}">` +
            `<span class="imp-dot" style="background:${color}"></span>` +
            `<span class="mg-imp-dot-n" style="color:${color}">${n}</span>` +
            `</span>`;
  }
  return `<span class="mg-imp-dots">${html}</span>`;
}

function langSelect(value) {
  const val = value || 'en';
  return `<select class="mg-lang-select" title="Language">
    <option value="en"${val === 'en' ? ' selected' : ''}>EN</option>
    <option value="cz"${val === 'cz' ? ' selected' : ''}>CZ</option>
  </select>`;
}

function importanceSelect(value) {
  const val = value || 3;
  return `<select class="mg-imp-select" title="Importance level">
    ${[1,2,3,4,5].map(i =>
      `<option value="${i}"${i === val ? ' selected' : ''}>${i} – ${IMPORTANCE_NAMES[i]}</option>`
    ).join('')}
  </select>`;
}

function renderMgGroup(group, path, idxInParent, totalInParent) {
  const subGroups = (group.groups || [])
    .map((g, i, arr) => renderMgGroup(g, `${path}.${i}`, i, arr.length))
    .join('');

  const colors = getImportanceColors();
  const items = (group.items || []).map((item, ii) => {
    const first  = ii === 0;
    const last   = ii === group.items.length - 1;
    const impBg  = impLightBg(colors[String(item.importance || 3)] || DEFAULT_IMPORTANCE_COLORS['3']);
    return `
    <div class="mg-item" data-path="${path}" data-ii="${ii}" style="background:${impBg}">
      <span class="mg-order-btns">
        <button class="mg-item-up mg-xs-btn" data-path="${path}" data-ii="${ii}" ${first ? 'disabled' : ''} title="Move up">&#8593;</button>
        <button class="mg-item-dn mg-xs-btn" data-path="${path}" data-ii="${ii}" ${last  ? 'disabled' : ''} title="Move down">&#8595;</button>
      </span>
      <input class="mg-input mg-item-title" value="${escHtml(item.title_en)}" placeholder="Title">
      <input class="mg-input mg-item-url"   value="${escHtml(item.url)}"      placeholder="URL">
      ${importanceSelect(item.importance)}
      ${langSelect(item.lang)}
      <button class="mg-item-del" data-path="${path}" data-ii="${ii}" title="Remove">&#10005;</button>
    </div>`;
  }).join('');

  const first    = idxInParent === 0;
  const last     = idxInParent === totalInParent - 1;
  const gColors  = getImportanceColors();
  const groupBg  = impLightBg(gColors[String(group.importance || 3)] || DEFAULT_IMPORTANCE_COLORS['3']);
  const mgCzCount = countCzLinks(group);

  return `
    <div class="mg-group mg-group--collapsed" data-path="${path}">
      <div class="mg-group-hd" style="background:${groupBg}">
        <button class="mg-toggle-btn mg-xs-btn" data-path="${path}" title="Collapse/expand">&#9654;</button>
        <input class="mg-group-name" value="${escHtml(group.name_en)}" placeholder="Group name">
        ${importanceSelect(group.importance)}
        <button class="mg-apply-imp-btn mg-xs-btn" data-path="${path}" title="Apply this importance to all items and sub-groups">&#8659; All</button>
        ${renderImpDots(group)}
        ${mgCzCount > 0 ? `<span class="lang-badge">CZ ${mgCzCount}</span>` : ''}
        <button class="mg-move-up mg-xs-btn" data-path="${path}" ${first ? 'disabled' : ''} title="Move up">&#8593;</button>
        <button class="mg-move-dn mg-xs-btn" data-path="${path}" ${last  ? 'disabled' : ''} title="Move down">&#8595;</button>
        <button class="mg-add-subgroup mg-xs-btn" data-path="${path}">+ Sub-group</button>
        <button class="mg-group-del" data-path="${path}">Remove</button>
      </div>
      <div class="mg-group-content">
        ${subGroups}
        <div class="mg-items">${items}</div>
        <button class="mg-add-item" data-path="${path}">+ Add Bookmark</button>
      </div>
    </div>`;
}

function renderManageDialog() {
  // Remember which groups are currently expanded so re-renders don't collapse them
  const expanded = new Set(
    [...document.querySelectorAll('#manage-body .mg-group:not(.mg-group--collapsed)')]
      .map(el => el.dataset.path)
  );
  const n = mgData.groups.length;
  document.getElementById('manage-body').innerHTML =
    mgData.groups.map((g, i) => renderMgGroup(g, String(i), i, n)).join('');
  document.querySelectorAll('#manage-body .mg-group').forEach(el => {
    if (expanded.has(el.dataset.path)) {
      el.classList.remove('mg-group--collapsed');
      const btn = el.querySelector(':scope > .mg-group-hd > .mg-toggle-btn');
      if (btn) btn.innerHTML = '&#9660;';
    }
  });
}

function collectMgGroup(groupEl, origGroup) {
  const name       = groupEl.querySelector(':scope > .mg-group-hd > .mg-group-name').value.trim();
  const importance = parseInt(groupEl.querySelector(':scope > .mg-group-hd > .mg-imp-select').value, 10);
  const items      = [];
  groupEl.querySelectorAll(':scope > .mg-group-content > .mg-items > .mg-item').forEach((el, ii) => {
    const orig  = (origGroup.items || [])[ii] || {};
    const title = el.querySelector('.mg-item-title').value.trim();
    const url   = el.querySelector('.mg-item-url').value.trim();
    const imp  = parseInt(el.querySelector('.mg-imp-select').value, 10);
    const lang = el.querySelector('.mg-lang-select').value;
    if (title && url) items.push({ id: orig.id || slugify(title), title_en: title, url, importance: imp, lang });
  });
  const subEls = [...groupEl.querySelectorAll(':scope > .mg-group-content > .mg-group')];
  const groups = subEls
    .map((el, i) => collectMgGroup(el, (origGroup.groups || [])[i] || {}))
    .filter(g => g.name_en);
  return { id: origGroup.id || slugify(name), name_en: name, importance, items, groups };
}

function collectMgData() {
  return {
    groups: [...document.querySelectorAll('#manage-body > .mg-group')]
      .map((el, i) => collectMgGroup(el, (mgData.groups || [])[i] || {}))
      .filter(g => g.name_en),
  };
}

/* ── Importance Colors Panel ───────────────────────────── */
function renderImportanceColors() {
  const colors = getImportanceColors();
  document.getElementById('importance-colors-body').innerHTML = [1,2,3,4,5].map(i => `
    <div class="mg-color-row">
      <span class="imp-dot" style="background:${colors[i]}"></span>
      <span class="mg-color-label">${i} &ndash; ${IMPORTANCE_NAMES[i]}</span>
      <input type="color" class="mg-color-input" data-level="${i}" value="${colors[i]}">
    </div>`).join('');

  document.querySelectorAll('.mg-color-input').forEach(input => {
    input.addEventListener('input', () => {
      const updated = getImportanceColors();
      updated[input.dataset.level] = input.value;
      saveImportanceColors(updated);
      buildSidebar();
      // refresh dots in the panel without re-rendering selects
      document.querySelectorAll('.mg-color-row').forEach((row, i) => {
        const dot = row.querySelector('.imp-dot');
        if (dot) dot.style.background = getImportanceColors()[i + 1];
      });
      // update info bar if open
      if (currentUrl) {
        const impColor = getImportanceColors()[String(currentImp)] || DEFAULT_IMPORTANCE_COLORS['3'];
        const bar = document.getElementById('content-info-bar');
        bar.style.borderBottomColor = impColor;
        bar.style.backgroundColor   = impLightBg(impColor);
      }
    });
  });
}

document.getElementById('reset-colors-btn').addEventListener('click', () => {
  saveImportanceColors({ ...DEFAULT_IMPORTANCE_COLORS });
  renderImportanceColors();
  buildSidebar();
});

/* ── Manage Dialog Events ──────────────────────────────── */
document.getElementById('manage-dialog').addEventListener('change', e => {
  if (e.target.classList.contains('mg-imp-select')) {
    const colors = getImportanceColors();
    const bg     = impLightBg(colors[e.target.value] || DEFAULT_IMPORTANCE_COLORS['3']);
    const row    = e.target.closest('.mg-item');
    if (row) { row.style.background = bg; return; }
    const hd = e.target.closest('.mg-group-hd');
    if (hd) { hd.style.background = bg; }
  }
});

document.getElementById('manage-dialog').addEventListener('click', e => {
  const path = e.target.dataset.path;
  const ii   = e.target.dataset.ii != null ? +e.target.dataset.ii : null;

  if (e.target.classList.contains('mg-toggle-btn')) {
    const groupEl = e.target.closest('.mg-group');
    const collapsed = groupEl.classList.toggle('mg-group--collapsed');
    e.target.innerHTML = collapsed ? '&#9654;' : '&#9660;';
    return;
  }

  if (e.target.classList.contains('mg-group-del')) {
    mgData = collectMgData();
    const target = getGroupByPath(path);
    if ((target.items || []).length || (target.groups || []).length) {
      alert('Remove all bookmarks and sub-groups from this group first.');
      return;
    }
    const parts  = path.split('.');
    const idx    = Number(parts.pop());
    const parent = parts.length ? getGroupByPath(parts.join('.')) : mgData;
    parent.groups.splice(idx, 1);
    renderManageDialog();
    return;
  }

  if (e.target.classList.contains('mg-item-del')) {
    mgData = collectMgData();
    getGroupByPath(path).items.splice(ii, 1);
    renderManageDialog();
    return;
  }

  if (e.target.classList.contains('mg-add-item')) {
    mgData = collectMgData();
    getGroupByPath(path).items.push({ id: '', title_en: '', url: '', importance: 3 });
    renderManageDialog();
    const rows = document.querySelectorAll(`.mg-group[data-path="${path}"] > .mg-items > .mg-item`);
    rows[rows.length - 1]?.querySelector('.mg-item-title')?.focus();
    return;
  }

  if (e.target.classList.contains('mg-add-subgroup')) {
    mgData = collectMgData();
    getGroupByPath(path).groups.push({ id: '', name_en: '', importance: 3, items: [], groups: [] });
    renderManageDialog();
    const subs = document.querySelectorAll(`.mg-group[data-path="${path}"] > .mg-group`);
    subs[subs.length - 1]?.querySelector('.mg-group-name')?.focus();
    return;
  }

  if (e.target.classList.contains('mg-apply-imp-btn')) {
    const groupEl = e.target.closest('.mg-group');
    const imp     = parseInt(groupEl.querySelector(':scope > .mg-group-hd > .mg-imp-select').value, 10);
    const colors  = getImportanceColors();
    const bg      = impLightBg(colors[String(imp)] || DEFAULT_IMPORTANCE_COLORS[String(imp)]);
    groupEl.querySelectorAll('.mg-group-content .mg-imp-select').forEach(sel => { sel.value = String(imp); });
    groupEl.querySelectorAll('.mg-group-content .mg-item').forEach(el => { el.style.background = bg; });
    groupEl.querySelectorAll('.mg-group-content .mg-group-hd').forEach(el => { el.style.background = bg; });
    return;
  }

  if (e.target.classList.contains('mg-move-up') || e.target.classList.contains('mg-move-dn')) {
    const dir    = e.target.classList.contains('mg-move-up') ? -1 : 1;
    mgData       = collectMgData();
    const parts  = path.split('.');
    const idx    = Number(parts.pop());
    const parent = parts.length ? getGroupByPath(parts.join('.')) : mgData;
    const newIdx = idx + dir;
    if (newIdx >= 0 && newIdx < parent.groups.length) {
      [parent.groups[idx], parent.groups[newIdx]] = [parent.groups[newIdx], parent.groups[idx]];
    }
    renderManageDialog();
    return;
  }

  if (e.target.classList.contains('mg-item-up') || e.target.classList.contains('mg-item-dn')) {
    const dir    = e.target.classList.contains('mg-item-up') ? -1 : 1;
    mgData       = collectMgData();
    const items  = getGroupByPath(path).items;
    const newIdx = ii + dir;
    if (newIdx >= 0 && newIdx < items.length) {
      [items[ii], items[newIdx]] = [items[newIdx], items[ii]];
    }
    renderManageDialog();
    return;
  }
});

document.getElementById('manage-add-group').addEventListener('click', () => {
  mgData = collectMgData();
  mgData.groups.push({ id: '', name_en: '', importance: 3, items: [], groups: [] });
  renderManageDialog();
  const groups = document.querySelectorAll('#manage-body > .mg-group');
  groups[groups.length - 1]?.querySelector('.mg-group-name')?.focus();
});

document.getElementById('manage-collapse-all').addEventListener('click', () => {
  const groups  = [...document.querySelectorAll('#manage-body .mg-group')];
  const anyOpen = groups.some(g => !g.classList.contains('mg-group--collapsed'));
  groups.forEach(g => {
    g.classList.toggle('mg-group--collapsed', anyOpen);
    const btn = g.querySelector(':scope > .mg-group-hd > .mg-toggle-btn');
    if (btn) btn.innerHTML = anyOpen ? '&#9654;' : '&#9660;';
  });
  const collapseBtn = document.getElementById('manage-collapse-all');
  collapseBtn.innerHTML = anyOpen ? '&#8862; Expand all' : '&#8855; Collapse all';
});

document.getElementById('manage-save').addEventListener('click', async () => {
  const data     = collectMgData();
  const statusEl = document.getElementById('manage-status');
  statusEl.className   = 'mg-status';
  statusEl.textContent = 'Saving…';
  try {
    const res  = await fetch('/api/links', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || res.statusText);
    window.LINK_TREE = json.linkTree;
    buildSidebar();
    statusEl.textContent = 'Saved ✓';
    setTimeout(() => {
      document.getElementById('manage-dialog').close();
      statusEl.textContent = '';
    }, 800);
  } catch (err) {
    statusEl.className   = 'mg-status error';
    statusEl.textContent = `Error: ${err.message}`;
  }
});

document.getElementById('manage-close').addEventListener('click', () => {
  document.getElementById('manage-dialog').close();
});
document.getElementById('manage-close-footer').addEventListener('click', () => {
  document.getElementById('manage-dialog').close();
});

document.getElementById('manage-btn').addEventListener('click', async () => {
  try {
    const res = await fetch('/api/links');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    mgData = await res.json();
    renderManageDialog();
    renderImportanceColors();
    document.getElementById('manage-status').textContent = '';
    document.getElementById('manage-collapse-all').innerHTML = '&#8862; Expand all';
    document.getElementById('manage-dialog').showModal();
  } catch {
    alert('Cannot connect to server. Run “npm start” to enable bookmark management.');
  }
});

/* ── Init ──────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  // Migrate old orange default (#f97316) to new yellow default (#eab308) for importance 2
  try {
    const saved = JSON.parse(localStorage.getItem('msb_importance_colors') || 'null');
    if (saved && saved['2'] === '#f97316') {
      saved['2'] = '#eab308';
      localStorage.setItem('msb_importance_colors', JSON.stringify(saved));
    }
  } catch { /* ignore */ }

  applyCssVars(getImportanceColors());
  applyOpenMode(getOpenMode());

  if (localStorage.getItem('msb_sidebar') === '0') {
    document.getElementById('layout').classList.add('sidebar-collapsed');
  }

  // Always start with all groups collapsed
  Object.keys(localStorage)
    .filter(k => k.startsWith('msb_cat_'))
    .forEach(k => localStorage.removeItem(k));

  if (!window.LINK_TREE) {
    try {
      const res = await fetch('/api/links');
      if (res.ok) window.LINK_TREE = await res.json();
    } catch { /* static mode — LINK_TREE injected inline */ }
  }

  buildSidebar();
});
