# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MyStudyBookmarks is a browser-bookmark manager SPA. Users import bookmarks from a browser HTML export, organize them with a 5-level importance system, and browse them in a two-column UI. Sibling project: **MyStudyPagesWithTranslation** (`../MyStudyPagesWithTranslation`) — copy patterns from it freely. Static HTML/CSS/vanilla JS; Express for the dev server and persistence API. No build system, no framework.

## Running

```bash
npm start       # node server.js → http://localhost:3000
```

No build step. Files are served directly.

## Architecture

### Stack
- Frontend: vanilla HTML/CSS/JavaScript
- Backend: Node.js + Express (static file server + REST API)
- Data: `bookmarks.json` (source of truth)

### Data flow
1. One-time import: browser exports `bookmarks.html` → `node parse-bookmarks.js` → `bookmarks.json`
2. Runtime: `app.js` reads `bookmarks.json` via `GET /api/links`, builds the sidebar, persists changes via `POST /api/links`

### Key files (to create)
| File | Purpose |
|---|---|
| `index.html` | App shell: topbar, sidebar `<nav>`, main `#content-body`, manage `<dialog>` |
| `app.js` | All client logic: sidebar builder, importance colors, manage dialog, iframe/tab loader |
| `server.js` | Express: static serving + `GET /api/links` / `POST /api/links` |
| `parse-bookmarks.js` | One-time converter: `bookmarks.html` → `bookmarks.json` |
| `style.css` | All styles; CSS variables for importance colors, Grid layout, responsive |
| `bookmarks.json` | Persisted bookmark tree |
| `package.json` | `{ "scripts": { "start": "node server.js" }, "dependencies": { "express": "..." } }` |

### bookmarks.json structure
```json
{
  "groups": [
    {
      "id": "group-slug",
      "name_en": "Group Name",
      "importance": 3,
      "groups": [],
      "items": [
        { "id": "item-slug", "title_en": "Page Title", "url": "https://...", "importance": 2 }
      ]
    }
  ]
}
```

### Layout
Two-column SPA: collapsible sidebar (bookmark tree) + main content panel (iframe or new-tab link). Header has a toggle: open links in main panel (iframe) vs. new browser tab.

### Importance system
- 5 levels: 1 = most important … 5 = least important; default for new items = 3
- Each level has a color (hex). Colors are editable via a settings/manage panel and stored in `localStorage` under `msb_importance_colors` (JSON object `{ "1": "#hex", ... }`).
- Colors apply as CSS variables `--importance-1-color` … `--importance-5-color` and are visible in the sidebar, manage dialog, and main panel header.

### State in localStorage
| Key | Value |
|---|---|
| `msb_importance_colors` | JSON `{ "1": "#hex", … "5": "#hex" }` |
| `msb_cat_<path>` | `"true"` / `"false"` (collapse state per group; path = `/`-joined IDs) |
| `msb_open_mode` | `"iframe"` or `"tab"` |

### Sidebar
Groups render as `<details>` elements (expand/collapse). Nested groups are rendered recursively. Collapse state persists in localStorage. Group path: ancestor IDs joined by `/` (e.g. `work/coding/frontend`).

### Manage dialog
Mirrors the pattern in `../MyStudyPagesWithTranslation/app.js`: a `<dialog>` element where users can add/edit/remove groups and items (title, URL, importance), and edit importance-level colors. Save → `POST /api/links`.

## Conventions
- IDs and slugs: kebab-case (`my-bookmarks`, `python-libs`)
- localStorage keys prefixed `msb_`
- CSS classes: kebab-case, semantic (`.bookmark-link`, `.importance-1`, `.active`)
- Colors in hex (e.g. `#e74c3c`)
- Groups can be nested arbitrarily deep; rendering must be recursive
