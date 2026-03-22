# Layout Debugger

Chrome extension (Manifest V3) that draws **layout overlays** on the page and shows a **CSS inspector** in the **side panel** so you can debug structure, box model, flex, and grid.

## Requirements

- **Chromium** browser with **Side Panel** support (Chrome, Edge, Brave, etc.).

## Install (development)

1. Open `chrome://extensions/`
2. Turn on **Developer mode**
3. Click **Load unpacked**
4. Choose this folder (`layout-debugger`)

Ensure `icons/icon16.png`, `icons/icon48.png`, and `icons/icon128.png` exist (they are included in this repo).

## Use

1. Click the extension icon → the **side panel** opens (`popup.html`).
2. Click **Toggle borders** → outlines and optional labels appear on the page.
3. **Click an element** on the page → details show in **CSS Inspector** (dimensions, margin, padding, borders, layout, flex/grid when relevant).
4. Use **Parent / Prev / Next / Child** in the inspector to move the selection without hunting in the DOM.
5. Turn **Toggle borders** off when finished.

### Side panel options

| Control | Purpose |
|--------|---------|
| Line style | Solid or dotted outlines |
| Border opacity | Fade overlays so you can see the page underneath |
| Overlay labels | Toggle element / padding / margin labels on the page |
| Hover preview | Inspect the element under the cursor (when enabled) |
| Monochrome | Use a single outline color instead of per-element hues |

Settings are stored with `chrome.storage.local` and restored when you open the panel again.

## How it works (short)

- **`content.js`** — Runs on web pages: draws outlines/labels, handles click/hover, collects `getComputedStyle` + geometry, talks to the panel via `chrome.runtime.sendMessage`.
- **`popup.js` / `popup.html` / `popup.css`** — Side panel UI and inspector rendering.
- **`background.js`** — Opens the side panel when the toolbar icon is clicked.
- **`manifest.json`** — Permissions (`activeTab`, `storage`, `sidePanel`), content scripts, icons.

## Reload after code changes

1. `chrome://extensions/` → **Reload** the extension.
2. Close and reopen the side panel for UI changes.
3. **Refresh** the tab you’re debugging for content script changes.

## Limitations

Won’t run on some restricted URLs (e.g. `chrome-extension://`, Web Store, many `chrome://` system pages, `view-source:`, `data:`, PDFs). The panel shows a short message when the page isn’t supported.

## License

[MIT](LICENSE)
