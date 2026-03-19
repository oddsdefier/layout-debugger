# Layout Debugger Browser Extension

A powerful browser extension for debugging and inspecting CSS layouts with visual overlays and detailed element information.

## Features

- 🎨 **Colored Borders** - Show colored borders on all elements based on their classes
- 📊 **Unified Sidebar** - Compact browser sidebar with integrated element inspector
- 🔍 **Click to Inspect** - Click any element to see detailed information directly in the sidebar
- 📐 **Dimension Information** - View width, height, position, and coordinates
- 📏 **Margin & Padding Display** - See all spacing values at a glance
- 🎯 **Grid & Flexbox Info** - Detailed information for CSS Grid and Flexbox layouts
- 🎨 **Minimalist UI** - Clean, compact interface optimized for space
- ⚡ **Smart Detection** - Automatically detects unsupported pages (chrome://, extension pages, etc.)

## Installation

### Chrome/Edge/Brave

1. Open your browser and navigate to `chrome://extensions/` (or `edge://extensions/` for Edge)
2. Enable "Developer mode" (toggle in the top right)
3. Click "Load unpacked"
4. Select the `layout-debugger` folder
5. The extension should now appear in your extensions list

### Firefox

1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select the `manifest.json` file from the `layout-debugger` folder

## Usage

1. **Open the Extension**
   - Click the extension icon in your browser toolbar
   - The extension opens in the browser's sidebar panel

2. **Activate Border Mode**
   - Click "Toggle Borders" button
   - Colored borders will appear on all elements
   - Each element gets a unique color based on its classes

3. **Inspect Elements**
   - Click on any element on the page
   - The element inspector at the bottom of the sidebar shows detailed information:
     - Element tag, ID, and classes with color indicator
     - Dimensions (width, height, X/Y position)
     - Margins (top, right, bottom, left)
     - Padding values
     - Display type (flex, grid, block, etc.)
     - Flex/Grid properties (if applicable)

4. **Navigate the Interface**
   - The selected element gets a red outline on the page
   - Element information updates instantly in the sidebar
   - All inspection happens within the browser sidebar - no overlapping panels
   - Compact, minimalist design maximizes screen space

5. **Deactivate**
   - Click "Toggle Borders" again to turn off the debugger
   - All borders and highlights will disappear
   - Close the extension sidebar with the ✕ button in the top-right

## Supported Pages

The extension works on:
- ✅ Regular websites (http://, https://)
- ✅ Local development servers (localhost)
- ✅ Chrome internal pages with HTML (chrome://, edge://)
- ✅ Local files (file://)
- ✅ Blank pages (about:blank)
- ✅ Any page with HTML elements

The extension **does not work** on:
- ❌ Extension pages (chrome-extension://)
- ❌ Chrome Web Store and extension stores
- ❌ PDF files (.pdf)
- ❌ About pages (except about:blank)
- ❌ View source pages (view-source:)
- ❌ Data URLs (data:)

**Note:** Chrome's security model may prevent the extension from running on certain system pages even if they have HTML. The extension will gracefully handle these cases.

When opened on an unsupported page, the extension will display a helpful message explaining why it cannot run.

## Icon Setup

The extension requires icon files. You can:

1. **Create your own icons** (16x16, 48x48, 128x128 pixels) and place them in the `icons/` folder as:
   - `icon16.png`
   - `icon48.png`
   - `icon128.png`

2. **Use placeholder icons** - The extension will work without icons, but you'll see a default puzzle piece icon

## Project Structure

```
layout-debugger/
├── manifest.json       # Extension manifest (uses side_panel API)
├── content.js          # Content script (runs on web pages, handles borders & inspection)
├── content.css         # Styles for labels and on-page elements
├── popup.html          # Sidebar panel UI HTML
├── popup.css           # Sidebar panel styles with gradients
├── popup.js            # Sidebar logic and message handling
├── background.js       # Background service worker (opens side panel)
├── icons/              # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── test.html           # Test page for trying out the extension
└── README.md           # This file
```

## Development

### Making Changes

1. Edit the files as needed
2. After making changes, reload the extension in `chrome://extensions/`
3. Close and reopen the side panel to see UI changes
4. Refresh the page you're debugging to see content script changes

### Testing

Open `test.html` in your browser to test the extension on a page with various layout types:
- Grid layouts
- Flexbox containers
- Nested elements
- Different CSS classes

### Key Files

- **content.js** - Main debugging logic, border rendering, and element selection
- **popup.js** - Sidebar panel logic, element inspector display, and message handling
- **popup.html/css** - Compact browser sidebar interface with integrated inspector
- **background.js** - Service worker that opens the side panel when extension icon is clicked

### Architecture

1. **User clicks extension icon** → Background service worker opens browser side panel
2. **User clicks "Toggle Borders"** → Popup sends message to content script
3. **Content script activates** → Adds colored borders to all elements and sets up click handlers
4. **User clicks element** → Content script sends element data to sidebar via message passing
5. **Sidebar updates** → Inspector section displays element information in real-time
6. **User clicks "Toggle Borders"** → Content script removes borders and highlights

## Browser Compatibility

- ✅ Chrome 88+
- ✅ Edge 88+
- ✅ Brave (Chromium-based)
- ✅ Firefox (with minor manifest adjustments)

## License

MIT

## Contributing

Feel free to submit issues and enhancement requests!

