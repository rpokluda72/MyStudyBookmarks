# MyStudyBookmarks

A personal bookmark manager SPA for organizing study resources with importance levels, inline preview, and filtering.

## Features

- **Two-column layout** — collapsible sidebar + inline iframe preview or new-tab mode
- **Importance levels 1–5** — color-coded; filter sidebar items by level using the toolbar buttons
- **Language filter** — All / EN / CZ toggle buttons in the sidebar toolbar
- **Inline editing** — edit title, importance, or delete a bookmark directly from the top bar
- **Manage dialog** — add/edit/remove groups and bookmarks; customize importance colors; changing a group's importance updates its background color live; **⇓ All** button propagates the group's importance to all its items and sub-groups at once
- **Iframe blocking detection** — detects `X-Frame-Options` / CSP `frame-ancestors` and shows an "Open in new tab" fallback
- **Importance & CZ summary dots** — group headers in both sidebar and manage dialog show colored dot counts per importance level and a CZ badge if the group contains Czech links
- **Static export** — generates a fully self-contained `static.html` (CSS, JS, and data all inlined; edit controls hidden)

## Getting Started

### Prerequisites

- Node.js 18+

### Install

```bash
npm install
```

### Run

```bash
npm start
# → http://localhost:3000
```

## npm Scripts

| Script       | Command              | Description                                         |
|--------------|----------------------|-----------------------------------------------------|
| `start`      | `npm start`          | Start the dev server at http://localhost:3000       |
| `stop`       | `npm run stop`       | Stop the server (kills port 3000)                   |
| `parse`      | `npm run parse`      | Convert `bookmarks-source.html` → `bookmarks.json`  |
| `parse-json` | `npm run parse-json` | Convert `bookmarks-source.json` → `bookmarks.json`  |
| `static`     | `npm run static`     | Generate self-contained `static.html`               |

## Importing Bookmarks

Two import paths are available — both produce the same `bookmarks.json` format.

### From a browser HTML export

Export bookmarks from any browser (Chrome, Firefox, Edge) as an HTML file, save it as `bookmarks-source.html` in the project root, then run:

```bash
npm run parse
# reads bookmarks-source.html → writes bookmarks.json
```

### From a Firefox JSON export

Firefox can export bookmarks as a JSON file (`Bookmarks > Manage Bookmarks > Import and Backup > Backup…`). Save the file as `bookmarks-source.json` in the project root, then run:

```bash
npm run parse-json
# reads bookmarks-source.json → writes bookmarks.json
```

You can also point either parser at any file name:

```bash
node parse-bookmarks.js my-export.html
node parse-bookmarks-json.js my-firefox-backup.json
```

### Both parsers

- **Importance is preserved** — if `bookmarks.json` already exists, both parsers read it first and carry over saved importance values (keyed by URL for items, by name for groups). Only new entries that have no prior record default to level 3.
- Language is auto-detected: `.cz` domain URLs → `cz`, everything else → `en`.
- Nested sub-groups are preserved at any depth.
- Loose bookmarks not inside any folder are collected into an **Other** group.

## Generating a Static File

Produces `static.html` — a single portable file with CSS, JS, and bookmark data inlined. Also pre-checks every hostname for iframe restrictions.

```bash
npm run static
```

Open `static.html` directly in any browser — no server needed.

## Project Structure

```
├── index.html               # App shell
├── app.js                   # All client-side logic
├── style.css                # All styles (CSS variables, grid layout, importance colors)
├── server.js                # Express: static serving + REST API
├── parse-bookmarks.js       # One-time converter: bookmarks-source.html → bookmarks.json
├── parse-bookmarks-json.js  # One-time converter: Firefox JSON export → bookmarks.json
├── generate-static.js       # Generates self-contained static.html
├── bookmarks.json           # Persisted bookmark tree (source of truth)
├── bookmarks-source.html    # Browser HTML export (input for parse)
├── bookmarks-source.json    # Firefox JSON export (input for parse-json)
└── package.json
```

## API

| Method | Path                     | Description                                  |
|--------|--------------------------|----------------------------------------------|
| GET    | `/api/links`             | Returns the full bookmark tree               |
| POST   | `/api/links`             | Saves the full bookmark tree                 |
| GET    | `/api/check-frame?url=…` | Checks whether a URL allows iframe embedding |

## Data Format

`bookmarks.json` structure:

```json
{
  "groups": [
    {
      "id": "group-slug",
      "name_en": "Group Name",
      "importance": 3,
      "groups": [],
      "items": [
        {
          "id": "item-slug",
          "title_en": "Page Title",
          "url": "https://example.com",
          "importance": 2,
          "lang": "en"
        }
      ]
    }
  ]
}
```

Groups can be nested arbitrarily deep. Each group and item carries its own `importance` value (1–5).

## Importance Levels

| Level | Name      | Default color      |
|-------|-----------|--------------------|
| 1     | Essential | Red `#ef4444`      |
| 2     | Important | Yellow `#eab308`   |
| 3     | Useful    | Blue `#3b82f6`     |
| 4     | Optional  | Green `#22c55e`    |
| 5     | Archive   | Gray `#94a3b8`     |

Colors are editable in the Manage dialog (⚙) and persisted in `localStorage`.

## localStorage Keys

| Key                     | Value                                                    |
|-------------------------|----------------------------------------------------------|
| `msb_importance_colors` | `{"1":"#hex",…,"5":"#hex"}`                              |
| `msb_cat_<path>`        | `"true"` / `"false"` — collapse state per group          |
| `msb_open_mode`         | `"iframe"` or `"tab"`                                    |
| `msb_imp_filter`        | JSON array of active importance levels, e.g. `[1,2,3]`  |
| `msb_sidebar`           | `"0"` when sidebar is collapsed                          |
