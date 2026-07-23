# Privacy

Layout Debugger is designed to inspect page layout information locally in the browser.

## Data handled by the extension

When you inspect a page, the extension may read:

- element names and hierarchy;
- element dimensions and position;
- computed CSS values such as margin, padding, border, display, Flexbox, and Grid properties;
- extension preferences such as overlay style and opacity.

## Data storage

Extension preferences are stored locally using `chrome.storage.local`.

## Data transmission

The current implementation does not send inspected page information or extension settings to an external server. It does not include analytics, advertising, or tracking code.

## Browser permissions

The extension requests access to pages so its content script can draw overlays and inspect the selected element. Some browser-managed and restricted pages cannot be accessed.

Any future change that introduces external data transmission must be clearly documented and reviewed before release.