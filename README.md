# Layout Debugger

[![Validate](https://github.com/oddsdefier/layout-debugger/actions/workflows/validate.yml/badge.svg)](https://github.com/oddsdefier/layout-debugger/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4.svg)](manifest.json)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](CONTRIBUTING.md)

A lightweight Chrome extension that makes CSS layout problems visible. It draws overlays directly on a page and provides a side-panel inspector for structure, box model, Flexbox, and Grid information.

> **Project status:** early-stage, functional, and open to feedback and contributions.

## Why this exists

Browser developer tools are powerful, but layout problems can still be difficult to understand at a glance. Layout Debugger focuses on a smaller workflow: select an element, see its boundaries and spacing, then move through nearby elements without repeatedly searching the DOM tree.

## Features

- Draw borders around page elements.
- Display optional element, padding, and margin labels.
- Inspect dimensions, margin, padding, borders, and layout properties.
- Show Flexbox and Grid details when relevant.
- Navigate to the selected element’s parent, previous sibling, next sibling, or child.
- Preview elements while hovering.
- Adjust line style, opacity, labels, and monochrome mode.
- Persist preferences locally between side-panel sessions.

## Requirements

- A Chromium-based browser with Side Panel support, such as Chrome, Edge, or Brave.
- A normal web page. Browser-managed URLs, extension pages, PDFs, and some restricted pages cannot be inspected.

## Install for development

1. Clone or download this repository.
2. Open `chrome://extensions/`.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the repository directory.

No build step is currently required.

## Usage

1. Click the extension icon to open the side panel.
2. Select **Toggle borders** to draw layout outlines.
3. Click an element on the page to inspect it.
4. Use **Parent**, **Prev**, **Next**, and **Child** to move through nearby elements.
5. Disable borders when finished.

### Side-panel controls

| Control | Purpose |
| --- | --- |
| Line style | Switch between solid and dotted outlines |
| Border opacity | Fade overlays to keep page content visible |
| Overlay labels | Show or hide element, padding, and margin labels |
| Hover preview | Inspect the element currently under the pointer |
| Monochrome | Use one outline color instead of per-element colors |

## Privacy and permissions

Layout Debugger processes inspected layout information locally. The current implementation does not include analytics or transmit inspected page data to an external server. Preferences are stored with `chrome.storage.local`.

The extension requests page access so its content script can draw overlays and read computed layout information. See [PRIVACY.md](PRIVACY.md) for details.

## Project structure

- `content.js` and `content.css` draw overlays, handle page interaction, and collect layout information.
- `popup.js`, `popup.html`, and `popup.css` implement the side-panel interface.
- `background.js` opens the side panel from the toolbar action.
- `manifest.json` defines Manifest V3 permissions, scripts, icons, and extension metadata.

## Development workflow

After changing files:

1. Reload the extension from `chrome://extensions/`.
2. Close and reopen the side panel after interface changes.
3. Refresh the inspected tab after content-script changes.

Pull requests run a lightweight validation workflow that checks the manifest, JavaScript syntax, required documentation, and extension icons.

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), search existing issues, and keep pull requests focused on one problem.

Useful project documents:

- [Roadmap](ROADMAP.md)
- [Support guide](SUPPORT.md)
- [Security policy](SECURITY.md)
- [Code of conduct](CODE_OF_CONDUCT.md)

## Limitations

- The extension cannot run on many `chrome://`, `chrome-extension://`, Web Store, `view-source:`, `data:`, and PDF pages.
- Browser compatibility currently focuses on Chromium browsers with Side Panel support.
- Automated browser tests are not yet included; contributors should follow the manual validation checklist.

## License

Layout Debugger is available under the [MIT License](LICENSE).
