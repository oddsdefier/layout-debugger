let showBorders = false;
let currentTabId = null;
let lastSelectedData = null;
let lastHoverData = null;

const DEFAULT_BORDER_OPACITY = 1;
const DEFAULT_LABEL_SETTINGS = {
  showElement: true,
  showPadding: true,
  showMargin: false
};
const DEFAULT_HOVER_INSPECT = false;
const DEFAULT_MONOCHROME_MODE = false;

document.addEventListener('DOMContentLoaded', async () => {
  const toggleBordersBtn = document.getElementById('toggleBordersBtn');
  const closeSidebarBtn = document.getElementById('closeSidebarBtn');
  const borderOpacityRange = document.getElementById('borderOpacityRange');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab?.id ?? null;

  if (!checkIfPageSupported(tab)) {
    showUnsupportedPageMessage();
    return;
  }

  await loadStoredControls();
  await loadState(tab.id);
  await applyStoredOverlaySettings(tab.id);
  showPageStatus(tab);
  setupMessageListener();

  function deactivateCurrentTab() {
    if (currentTabId) {
      chrome.tabs.sendMessage(currentTabId, { action: 'deactivateAll' }).catch(() => {});
    }
  }

  window.addEventListener('beforeunload', deactivateCurrentTab);

  closeSidebarBtn?.addEventListener('click', () => {
    deactivateCurrentTab();
    window.close();
  });

  // Deactivate when user switches tabs
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    deactivateCurrentTab();
    showBorders = false;
    updateBordersButton();
    lastSelectedData = null;
    lastHoverData = null;
    clearInspector();
    currentTabId = activeInfo.tabId;
  });

  // Deactivate when user navigates within the same tab
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (tabId === currentTabId && changeInfo.status === 'loading') {
      showBorders = false;
      updateBordersButton();
      lastSelectedData = null;
      lastHoverData = null;
      clearInspector();
    }
  });
  toggleBordersBtn?.addEventListener('click', async () => {
    await toggleBorders(tab.id);
  });

  document.querySelectorAll('input[name="lineStyle"]').forEach((radio) => {
    radio.addEventListener('change', async (event) => {
      const lineStyle = event.target.value;
      await saveLineStyleToStorage(lineStyle);
      await setLineStyleInTab(tab.id, lineStyle);
    });
  });

  borderOpacityRange?.addEventListener('input', async (event) => {
    const borderOpacity = Number(event.target.value) / 100;
    updateBorderOpacityValue(borderOpacity);
    await saveBorderOpacityToStorage(borderOpacity);
    await setBorderOpacityInTab(tab.id, borderOpacity);
  });

  document.querySelectorAll('input[name="labelElement"], input[name="labelPadding"], input[name="labelMargin"]').forEach((checkbox) => {
    checkbox.addEventListener('change', async () => {
      const labelSettings = getSelectedLabelSettings();
      await saveLabelSettingsToStorage(labelSettings);
      await setLabelSettingsInTab(tab.id, labelSettings);
    });
  });

  document.querySelector('input[name="hoverInspect"]')?.addEventListener('change', async (event) => {
    const hoverInspectEnabled = event.target.checked;
    await saveHoverInspectToStorage(hoverInspectEnabled);
    await setHoverInspectInTab(tab.id, hoverInspectEnabled);
    if (!hoverInspectEnabled) {
      lastHoverData = null;
      lastSelectedData = null;
      clearInspector();
    }
  });

  document.querySelector('input[name="monochromeMode"]')?.addEventListener('change', async (event) => {
    const monochromeEnabled = event.target.checked;
    await saveMonochromeModeToStorage(monochromeEnabled);
    await setMonochromeModeInTab(tab.id, monochromeEnabled);
  });

  document.getElementById('inspectorContent')?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-nav]');
    if (!button || !currentTabId) return;
    await navigateSelection(currentTabId, button.dataset.nav);
  });
});

function getSelectedLineStyle() {
  const selectedInput = document.querySelector('input[name="lineStyle"]:checked');
  return selectedInput ? selectedInput.value : 'solid';
}

function getSelectedBorderOpacity() {
  const range = document.getElementById('borderOpacityRange');
  return range ? Number(range.value) / 100 : DEFAULT_BORDER_OPACITY;
}

function getSelectedLabelSettings() {
  return {
    showElement: document.querySelector('input[name="labelElement"]')?.checked ?? DEFAULT_LABEL_SETTINGS.showElement,
    showPadding: document.querySelector('input[name="labelPadding"]')?.checked ?? DEFAULT_LABEL_SETTINGS.showPadding,
    showMargin: document.querySelector('input[name="labelMargin"]')?.checked ?? DEFAULT_LABEL_SETTINGS.showMargin
  };
}

async function toggleBorders(tabId) {
  try {
    const response = await sendMessage(tabId, 'toggleBorders', {
      lineStyle: getSelectedLineStyle(),
      borderOpacity: getSelectedBorderOpacity(),
      labelSettings: getSelectedLabelSettings()
    });

    if (response?.success) {
      showBorders = response.active;
      updateBordersButton();
      saveState();
    }
  } catch (error) {
    console.error('Error toggling borders:', error);
    showErrorMessage('Failed to toggle borders. Please refresh the page and try again.');
  }
}

async function setLineStyleInTab(tabId, lineStyle) {
  try {
    await sendMessage(tabId, 'setLineStyle', { lineStyle });
  } catch (error) {
    console.error('Error setting line style:', error);
  }
}

async function setBorderOpacityInTab(tabId, borderOpacity) {
  try {
    await sendMessage(tabId, 'setBorderOpacity', { borderOpacity });
  } catch (error) {
    console.error('Error setting border opacity:', error);
  }
}

async function setLabelSettingsInTab(tabId, labelSettings) {
  try {
    await sendMessage(tabId, 'setLabelSettings', { labelSettings });
  } catch (error) {
    console.error('Error setting label settings:', error);
  }
}

async function setHoverInspectInTab(tabId, hoverInspectEnabled) {
  try {
    await sendMessage(tabId, 'setHoverInspect', { hoverInspectEnabled });
  } catch (error) {
    console.error('Error setting hover inspect:', error);
  }
}

async function navigateSelection(tabId, direction) {
  try {
    const response = await sendMessage(tabId, 'navigateSelection', { direction });
    if (response?.success) {
      lastHoverData = null;
    }
  } catch (error) {
    console.error('Error navigating selection:', error);
  }
}

async function setMonochromeModeInTab(tabId, monochromeEnabled) {
  try {
    await sendMessage(tabId, 'setMonochromeMode', { monochromeEnabled });
  } catch (error) {
    console.error('Error setting monochrome mode:', error);
  }
}

async function sendMessage(tabId, action, payload = {}) {
  return chrome.tabs.sendMessage(tabId, { action, ...payload });
}

function updateBordersButton() {
  const toggleBtn = document.getElementById('toggleBordersBtn');
  if (!toggleBtn) return;

  const btnText = toggleBtn.querySelector('.btn-text');

  if (showBorders) {
    toggleBtn.classList.add('active');
    btnText.textContent = 'Hide Borders';
  } else {
    toggleBtn.classList.remove('active');
    btnText.textContent = 'Show Borders';
  }
}

async function loadStoredControls() {
  const result = await chrome.storage.local.get([
    'layoutDebuggerLineStyle',
    'layoutDebuggerBorderOpacity',
    'layoutDebuggerLabelSettings',
    'layoutDebuggerHoverInspect',
    'layoutDebuggerMonochromeMode'
  ]);

  const lineStyle = result.layoutDebuggerLineStyle || 'solid';
  const lineStyleInput = document.querySelector(`input[name="lineStyle"][value="${lineStyle}"]`);
  if (lineStyleInput) lineStyleInput.checked = true;

  const borderOpacity = typeof result.layoutDebuggerBorderOpacity === 'number'
    ? result.layoutDebuggerBorderOpacity
    : DEFAULT_BORDER_OPACITY;
  const range = document.getElementById('borderOpacityRange');
  if (range) {
    range.value = String(Math.round(borderOpacity * 100));
  }
  updateBorderOpacityValue(borderOpacity);

  applyLabelSettingsToInputs(result.layoutDebuggerLabelSettings || DEFAULT_LABEL_SETTINGS);

  const hoverInspect = typeof result.layoutDebuggerHoverInspect === 'boolean'
    ? result.layoutDebuggerHoverInspect
    : DEFAULT_HOVER_INSPECT;
  const hoverInput = document.querySelector('input[name="hoverInspect"]');
  if (hoverInput) hoverInput.checked = hoverInspect;

  const monochromeMode = typeof result.layoutDebuggerMonochromeMode === 'boolean'
    ? result.layoutDebuggerMonochromeMode
    : DEFAULT_MONOCHROME_MODE;
  const monochromeInput = document.querySelector('input[name="monochromeMode"]');
  if (monochromeInput) monochromeInput.checked = monochromeMode;
}

async function loadState(tabId) {
  try {
    const response = await sendMessage(tabId, 'getState');
    if (!response) return;

    // Only sync showBorders from content script — it reflects actual toggle state
    // All other settings come from stored controls (loadStoredControls)
    if (typeof response.showBorders === 'boolean') {
      showBorders = response.showBorders;
      updateBordersButton();
    }
  } catch (error) {
    showBorders = false;
    updateBordersButton();
  }
}

function saveState() {
  chrome.storage.local.set({
    layoutDebuggerLineStyle: getSelectedLineStyle(),
    layoutDebuggerBorderOpacity: getSelectedBorderOpacity(),
    layoutDebuggerLabelSettings: getSelectedLabelSettings(),
    layoutDebuggerHoverInspect: getHoverInspectEnabled(),
    layoutDebuggerMonochromeMode: getMonochromeModeEnabled()
  });
}

async function applyStoredOverlaySettings(tabId) {
  await setBorderOpacityInTab(tabId, getSelectedBorderOpacity());
  await setLabelSettingsInTab(tabId, getSelectedLabelSettings());
  await setHoverInspectInTab(tabId, getHoverInspectEnabled());
  await setMonochromeModeInTab(tabId, getMonochromeModeEnabled());
}

function updateBorderOpacityValue(opacity) {
  const value = document.getElementById('borderOpacityValue');
  if (value) {
    value.textContent = `${Math.round(opacity * 100)}%`;
  }
}

function applyLabelSettingsToInputs(labelSettings) {
  const settings = { ...DEFAULT_LABEL_SETTINGS, ...labelSettings };
  const element = document.querySelector('input[name="labelElement"]');
  const padding = document.querySelector('input[name="labelPadding"]');
  const margin = document.querySelector('input[name="labelMargin"]');

  if (element) element.checked = settings.showElement;
  if (padding) padding.checked = settings.showPadding;
  if (margin) margin.checked = settings.showMargin;
}

function getHoverInspectEnabled() {
  return document.querySelector('input[name="hoverInspect"]')?.checked ?? DEFAULT_HOVER_INSPECT;
}

function getMonochromeModeEnabled() {
  return document.querySelector('input[name="monochromeMode"]')?.checked ?? DEFAULT_MONOCHROME_MODE;
}

function saveLineStyleToStorage(lineStyle) {
  return chrome.storage.local.set({ layoutDebuggerLineStyle: lineStyle });
}

function saveBorderOpacityToStorage(borderOpacity) {
  return chrome.storage.local.set({ layoutDebuggerBorderOpacity: borderOpacity });
}

function saveLabelSettingsToStorage(labelSettings) {
  return chrome.storage.local.set({ layoutDebuggerLabelSettings: labelSettings });
}

function saveHoverInspectToStorage(hoverInspectEnabled) {
  return chrome.storage.local.set({ layoutDebuggerHoverInspect: hoverInspectEnabled });
}

function saveMonochromeModeToStorage(monochromeEnabled) {
  return chrome.storage.local.set({ layoutDebuggerMonochromeMode: monochromeEnabled });
}

function showPageStatus(tab) {
  const pageStatus = document.getElementById('pageStatus');
  if (!pageStatus || !tab?.url) return;

  try {
    const url = new URL(tab.url);
    const displayUrl = `${url.hostname}${url.pathname}`;
    const truncatedUrl = displayUrl.length > 50 ? `${displayUrl.substring(0, 47)}...` : displayUrl;
    pageStatus.innerHTML = `<strong>Active on:</strong> ${truncatedUrl}`;
  } catch (error) {
    pageStatus.innerHTML = '<strong>Active on:</strong> Current page';
  }
}

function checkIfPageSupported(tab) {
  if (!tab?.url) return false;

  const url = tab.url;
  if (url === 'about:blank') return true;

  const unsupportedProtocols = ['chrome-extension://', 'about:', 'view-source:', 'data:'];
  if (unsupportedProtocols.some((protocol) => url.startsWith(protocol))) {
    return false;
  }

  const restrictedDomains = [
    'chrome.google.com/webstore',
    'chromewebstore.google.com',
    'microsoftedge.microsoft.com/addons'
  ];
  if (restrictedDomains.some((domain) => url.includes(domain))) {
    return false;
  }

  return !(url.endsWith('.pdf') || url.includes('.pdf#'));
}

function showUnsupportedPageMessage() {
  const container = document.querySelector('.container');
  if (!container) return;

  container.innerHTML = `
    <header>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
        <div style="flex: 1;">
          <h1>Layout Debugger</h1>
          <p style="margin-top: 6px; font-size: 12px; color: #6f6257;">Inspect element layout without extra tooling</p>
        </div>
        <button id="closeSidebarBtn" class="close-btn" title="Close sidebar">✕</button>
      </div>
    </header>
    <div style="text-align: center; padding: 40px 20px;">
      <div style="font-size: 64px; margin-bottom: 20px;">🚫</div>
      <h2 style="color: #a4492a; margin-bottom: 16px; font-size: 20px;">Page Not Supported</h2>
      <p style="color: #6f6257; line-height: 1.6; margin-bottom: 20px;">
        This extension cannot run on this page because the browser blocks content scripts here.
      </p>
    </div>
  `;

  document.getElementById('closeSidebarBtn')?.addEventListener('click', () => window.close());
}

function showErrorMessage(message) {
  const existingError = document.getElementById('error-notification');
  if (existingError) {
    existingError.remove();
  }

  const errorDiv = document.createElement('div');
  errorDiv.id = 'error-notification';
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(238, 90, 111, 0.4);
    font-size: 14px;
    font-weight: 500;
    z-index: 10000;
    max-width: 90%;
    text-align: center;
    animation: slideDown 0.3s ease;
  `;
  errorDiv.textContent = message;

  document.body.appendChild(errorDiv);

  setTimeout(() => {
    errorDiv.style.animation = 'slideUp 0.3s ease';
    setTimeout(() => errorDiv.remove(), 300);
  }, 5000);
}

const style = document.createElement('style');
style.textContent = `
  @keyframes slideDown {
    from {
      transform: translateX(-50%) translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
    to {
      transform: translateX(-50%) translateY(-100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.tab?.id !== currentTabId) return true;

    if (message.action === 'elementSelected') {
      lastSelectedData = message.data;
      if (!lastHoverData) {
        updateInspector(message.data);
      }
      sendResponse({ success: true });
    }

    if (message.action === 'elementHovered') {
      if (!getHoverInspectEnabled()) {
        lastHoverData = null;
        sendResponse({ success: true, ignored: true });
        return true;
      }
      lastHoverData = message.data;
      updateInspector(message.data);
      sendResponse({ success: true });
    }

    if (message.action === 'hoverCleared') {
      lastHoverData = null;
      if (lastSelectedData) {
        updateInspector(lastSelectedData);
      } else {
        clearInspector();
      }
      sendResponse({ success: true });
    }

    if (message.action === 'elementDeselected') {
      lastSelectedData = null;
      lastHoverData = null;
      clearInspector();
      sendResponse({ success: true });
    }

    return true;
  });
}

function clearInspector() {
  const content = document.getElementById('inspectorContent');
  if (!content) return;

  content.innerHTML = '<p class="inspector-empty">Click an element to inspect</p>';
}

const TW_SPACING = new Map([
  [0, '0'], [1, 'px'], [2, '0.5'], [4, '1'], [6, '1.5'], [8, '2'],
  [10, '2.5'], [12, '3'], [14, '3.5'], [16, '4'], [20, '5'], [24, '6'],
  [28, '7'], [32, '8'], [36, '9'], [40, '10'], [44, '11'], [48, '12'],
  [56, '14'], [64, '16'], [80, '20'], [96, '24'], [112, '28'], [128, '32'],
  [144, '36'], [160, '40'], [176, '44'], [192, '48'], [208, '52'], [224, '56'],
  [240, '60'], [256, '64'], [288, '72'], [320, '80'], [384, '96']
]);

const TW_FONT_SIZE = new Map([
  [12, 'xs'], [14, 'sm'], [16, 'base'], [18, 'lg'], [20, 'xl'],
  [24, '2xl'], [30, '3xl'], [36, '4xl'], [48, '5xl'], [60, '6xl'],
  [72, '7xl'], [96, '8xl'], [128, '9xl']
]);

const TW_RADIUS = new Map([
  [0, 'none'], [2, 'sm'], [4, 'DEFAULT'], [6, 'md'], [8, 'lg'],
  [12, 'xl'], [16, '2xl'], [24, '3xl']
]);

const TW_FONT_WEIGHT = new Map([
  ['100', 'thin'], ['200', 'extralight'], ['300', 'light'], ['400', 'normal'],
  ['500', 'medium'], ['600', 'semibold'], ['700', 'bold'], ['800', 'extrabold'], ['900', 'black']
]);

function getTwSpacing(px) {
  const rounded = Math.round(px);
  return TW_SPACING.get(rounded) || null;
}

function getTwFontSize(px) {
  const rounded = Math.round(px);
  return TW_FONT_SIZE.get(rounded) || null;
}

function getTwRadius(px) {
  const rounded = Math.round(px);
  return TW_RADIUS.get(rounded) || null;
}

function formatFontSizeTw(value) {
  if (value == null || value === '') return '—';
  const numeric = parseFloat(value);
  if (Number.isNaN(numeric)) return String(value);
  const px = Math.round(numeric);
  const tw = getTwFontSize(px);
  const twTag = tw ? `<span class="tw-badge">text-${tw}</span>` : '';
  return `${px}px ${twTag}`;
}

function formatRadiusTw(value, prefix) {
  if (value == null || value === '') return '—';
  const trimmed = String(value).trim();
  if (trimmed === '0px' || trimmed === '0') {
    return `0 <span class="tw-badge">${prefix}-none</span>`;
  }
  const numeric = parseFloat(trimmed);
  if (Number.isNaN(numeric)) return trimmed;
  const px = Math.round(numeric);
  const tw = getTwRadius(px);
  const twTag = tw ? `<span class="tw-badge">${prefix}${tw === 'DEFAULT' ? '' : '-' + tw}</span>` : '';
  return `${px}px ${twTag}`;
}

function formatFontWeightTw(value) {
  if (value == null || value === '') return '—';
  const trimmed = String(value).trim();
  const tw = TW_FONT_WEIGHT.get(trimmed);
  const twTag = tw ? `<span class="tw-badge">font-${tw}</span>` : '';
  return `${trimmed} ${twTag}`;
}

const TW_LINE_HEIGHT = new Map([
  ['1', 'none'], ['1.25', 'tight'], ['1.375', 'snug'], ['1.5', 'normal'],
  ['1.625', 'relaxed'], ['2', 'loose']
]);

const TW_LETTER_SPACING = {
  '-0.05em': 'tighter', '-0.025em': 'tight', '0em': 'normal', '0px': 'normal',
  '0.025em': 'wide', '0.05em': 'wider', '0.1em': 'widest'
};

const TW_TEXT_ALIGN = { start: 'left', left: 'left', center: 'center', right: 'right', end: 'right', justify: 'justify' };
const TW_TEXT_TRANSFORM = { none: 'normal-case', uppercase: 'uppercase', lowercase: 'lowercase', capitalize: 'capitalize' };
const TW_OPACITY = new Map([
  ['0', '0'], ['0.05', '5'], ['0.1', '10'], ['0.15', '15'], ['0.2', '20'], ['0.25', '25'],
  ['0.3', '30'], ['0.35', '35'], ['0.4', '40'], ['0.45', '45'], ['0.5', '50'],
  ['0.55', '55'], ['0.6', '60'], ['0.65', '65'], ['0.7', '70'], ['0.75', '75'],
  ['0.8', '80'], ['0.85', '85'], ['0.9', '90'], ['0.95', '95'], ['1', '100']
]);

function formatLineHeightTw(value, fontSize) {
  if (value == null || value === '' || value === 'normal') return formatCssValue(value);
  const trimmed = String(value).trim();

  // Check ratio-based (unitless or ratio to font-size)
  const tw = TW_LINE_HEIGHT.get(trimmed);
  if (tw) return `${trimmed} <span class="tw-badge">leading-${tw}</span>`;

  // Check px-based: compute ratio if fontSize available
  const lhPx = parseFloat(trimmed);
  const fsPx = parseFloat(fontSize);
  if (!Number.isNaN(lhPx) && !Number.isNaN(fsPx) && fsPx > 0) {
    const ratio = (lhPx / fsPx).toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
    const twRatio = TW_LINE_HEIGHT.get(ratio);
    if (twRatio) return `${Math.round(lhPx)}px <span class="tw-badge">leading-${twRatio}</span>`;

    // Check fixed leading values
    const twSpacing = getTwSpacing(Math.round(lhPx));
    if (twSpacing) return `${Math.round(lhPx)}px <span class="tw-badge">leading-${twSpacing}</span>`;
  }

  return formatCssValue(value);
}

function formatLetterSpacingTw(value) {
  if (value == null || value === '') return '—';
  const trimmed = String(value).trim();
  if (trimmed === 'normal' || trimmed === '0px' || trimmed === '0') {
    return `${trimmed} <span class="tw-badge">tracking-normal</span>`;
  }
  const tw = TW_LETTER_SPACING[trimmed];
  if (tw) return `${trimmed} <span class="tw-badge">tracking-${tw}</span>`;
  return formatCssValue(value);
}

function formatTextAlignTw(value) {
  if (value == null || value === '') return '—';
  const trimmed = String(value).trim();
  const tw = TW_TEXT_ALIGN[trimmed];
  if (tw) return `${trimmed} <span class="tw-badge">text-${tw}</span>`;
  return trimmed;
}

function formatTextTransformTw(value) {
  if (value == null || value === '') return '—';
  const trimmed = String(value).trim();
  const tw = TW_TEXT_TRANSFORM[trimmed];
  if (tw) return `${trimmed} <span class="tw-badge">${tw}</span>`;
  return trimmed;
}

function formatOpacityTw(value) {
  if (value == null || value === '') return '—';
  const trimmed = String(value).trim();
  const tw = TW_OPACITY.get(trimmed);
  if (tw) return `${trimmed} <span class="tw-badge">opacity-${tw}</span>`;
  return trimmed;
}

function parseColorToHex(colorStr) {
  if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = colorStr;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  if (a === 0) return null;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function formatColorValue(value) {
  if (value == null || value === '') return '—';
  const trimmed = String(value).trim();
  if (trimmed === 'transparent' || trimmed === 'rgba(0, 0, 0, 0)') {
    return `transparent <span class="tw-badge">transparent</span>`;
  }
  const hex = parseColorToHex(trimmed);
  const swatch = hex ? `<span class="color-swatch" style="background:${trimmed};"></span>` : '';
  return `${swatch}${escapeHtml(trimmed)}`;
}

function formatCssValue(value) {
  if (value == null || value === '') return '—';
  const trimmed = String(value).trim();
  if (trimmed === '0px' || trimmed === '0') return '0';
  return trimmed;
}

function formatSize(value) {
  if (value == null || value === '') return '—';

  const trimmed = String(value).trim();
  if (['auto', 'inherit', 'initial', 'none'].includes(trimmed)) {
    return trimmed;
  }

  const numeric = typeof value === 'number' ? value : parseFloat(trimmed);
  if (Number.isNaN(numeric)) return trimmed;

  return `${Math.round(numeric)}px`;
}

function formatSizeTw(value, prefix) {
  if (value == null || value === '') return '—';

  const trimmed = String(value).trim();
  if (trimmed === '0px' || trimmed === '0') {
    return `0 <span class="tw-badge">${prefix}-0</span>`;
  }
  if (['auto', 'inherit', 'initial', 'none'].includes(trimmed)) {
    const twAuto = trimmed === 'auto' ? `<span class="tw-badge">${prefix}-auto</span>` : '';
    return `${trimmed} ${twAuto}`;
  }

  const numeric = typeof value === 'number' ? value : parseFloat(trimmed);
  if (Number.isNaN(numeric)) return trimmed;

  const px = Math.round(numeric);
  const tw = getTwSpacing(px);
  const twTag = tw ? `<span class="tw-badge">${prefix}-${tw}</span>` : '';
  return `${px}px ${twTag}`;
}

function updateInspector(elementData) {
  const content = document.getElementById('inspectorContent');
  if (!content || !elementData) return;

  const { tag, id, classes, color, selector, rect, styles, parentContext, navigation, mode } = elementData;
  const modeLabel = mode === 'hover' ? 'Hover preview' : 'Selected';
  const nav = navigation || {};

  let html = `
    <div class="element-tag">
      <div class="element-color" style="background: ${color};"></div>
      <div class="element-name">
        <span class="element-mode">${escapeHtml(modeLabel)}</span>
        <span class="tag">${tag}</span>
        ${id ? `<span class="id">#${id}</span>` : ''}
        ${classes.length > 0 ? `<span class="class">${escapeHtml(classes.join(' '))}</span>` : ''}
      </div>
    </div>
    <div class="inspector-nav">
      <button class="nav-btn" data-nav="parent" ${nav.parent ? '' : 'disabled'}>Parent</button>
      <button class="nav-btn" data-nav="previous" ${nav.previous ? '' : 'disabled'}>Prev</button>
      <button class="nav-btn" data-nav="next" ${nav.next ? '' : 'disabled'}>Next</button>
      <button class="nav-btn" data-nav="child" ${nav.child ? '' : 'disabled'}>Child</button>
    </div>
    <div class="selector-line"><code class="selector-code">${escapeHtml(selector || '')}</code></div>

    <div class="info-section">
      <div class="info-section-title">Dimensions</div>
      <div class="info-grid">
        <div class="info-item"><div class="info-item-label">Width</div><div class="info-item-value">${formatSizeTw(rect.width, 'w')}</div></div>
        <div class="info-item"><div class="info-item-label">Height</div><div class="info-item-value">${formatSizeTw(rect.height, 'h')}</div></div>
        <div class="info-item"><div class="info-item-label">X</div><div class="info-item-value">${formatSize(rect.left)}</div></div>
        <div class="info-item"><div class="info-item-label">Y</div><div class="info-item-value">${formatSize(rect.top)}</div></div>
      </div>
    </div>

    <div class="info-section">
      <div class="info-section-title">Box model</div>
      <div class="info-list">
        <div class="info-list-item"><span class="info-list-item-label">box-sizing</span><span class="info-list-item-value">${formatCssValue(styles.boxSizing)}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">overflow-x</span><span class="info-list-item-value">${formatCssValue(styles.overflowX)}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">overflow-y</span><span class="info-list-item-value">${formatCssValue(styles.overflowY)}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">z-index</span><span class="info-list-item-value">${formatCssValue(styles.zIndex)}</span></div>
      </div>
    </div>

    <div class="info-section">
      <div class="info-section-title">Margin</div>
      <div class="info-list">
        <div class="info-list-item"><span class="info-list-item-label">Top</span><span class="info-list-item-value">${formatSizeTw(styles.marginTop, 'mt')}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">Right</span><span class="info-list-item-value">${formatSizeTw(styles.marginRight, 'mr')}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">Bottom</span><span class="info-list-item-value">${formatSizeTw(styles.marginBottom, 'mb')}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">Left</span><span class="info-list-item-value">${formatSizeTw(styles.marginLeft, 'ml')}</span></div>
      </div>
    </div>

    <div class="info-section">
      <div class="info-section-title">Padding</div>
      <div class="info-list">
        <div class="info-list-item"><span class="info-list-item-label">Top</span><span class="info-list-item-value">${formatSizeTw(styles.paddingTop, 'pt')}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">Right</span><span class="info-list-item-value">${formatSizeTw(styles.paddingRight, 'pr')}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">Bottom</span><span class="info-list-item-value">${formatSizeTw(styles.paddingBottom, 'pb')}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">Left</span><span class="info-list-item-value">${formatSizeTw(styles.paddingLeft, 'pl')}</span></div>
      </div>
    </div>
  `;

  if (styles.borderTop || styles.borderRight || styles.borderBottom || styles.borderLeft) {
    html += `
      <div class="info-section">
        <div class="info-section-title">Border (width)</div>
        <div class="info-list">
          <div class="info-list-item"><span class="info-list-item-label">Top</span><span class="info-list-item-value">${formatSizeTw(styles.borderTop, 'border-t')}</span></div>
          <div class="info-list-item"><span class="info-list-item-label">Right</span><span class="info-list-item-value">${formatSizeTw(styles.borderRight, 'border-r')}</span></div>
          <div class="info-list-item"><span class="info-list-item-label">Bottom</span><span class="info-list-item-value">${formatSizeTw(styles.borderBottom, 'border-b')}</span></div>
          <div class="info-list-item"><span class="info-list-item-label">Left</span><span class="info-list-item-value">${formatSizeTw(styles.borderLeft, 'border-l')}</span></div>
        </div>
      </div>
    `;
  }

  const hasRadius = styles.borderRadius && styles.borderRadius !== '0px';
  if (hasRadius) {
    const allSame = styles.borderTopLeftRadius === styles.borderTopRightRadius &&
      styles.borderTopRightRadius === styles.borderBottomRightRadius &&
      styles.borderBottomRightRadius === styles.borderBottomLeftRadius;

    if (allSame) {
      html += `
        <div class="info-section">
          <div class="info-section-title">Border radius</div>
          <div class="info-list">
            <div class="info-list-item"><span class="info-list-item-label">All</span><span class="info-list-item-value">${formatRadiusTw(styles.borderTopLeftRadius, 'rounded')}</span></div>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="info-section">
          <div class="info-section-title">Border radius</div>
          <div class="info-list">
            <div class="info-list-item"><span class="info-list-item-label">Top-left</span><span class="info-list-item-value">${formatRadiusTw(styles.borderTopLeftRadius, 'rounded-tl')}</span></div>
            <div class="info-list-item"><span class="info-list-item-label">Top-right</span><span class="info-list-item-value">${formatRadiusTw(styles.borderTopRightRadius, 'rounded-tr')}</span></div>
            <div class="info-list-item"><span class="info-list-item-label">Bottom-right</span><span class="info-list-item-value">${formatRadiusTw(styles.borderBottomRightRadius, 'rounded-br')}</span></div>
            <div class="info-list-item"><span class="info-list-item-label">Bottom-left</span><span class="info-list-item-value">${formatRadiusTw(styles.borderBottomLeftRadius, 'rounded-bl')}</span></div>
          </div>
        </div>
      `;
    }
  }

  html += `
    <div class="info-section">
      <div class="info-section-title">Typography</div>
      <div class="info-list">
        <div class="info-list-item"><span class="info-list-item-label">font-size</span><span class="info-list-item-value">${formatFontSizeTw(styles.fontSize)}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">font-weight</span><span class="info-list-item-value">${formatFontWeightTw(styles.fontWeight)}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">line-height</span><span class="info-list-item-value">${formatLineHeightTw(styles.lineHeight, styles.fontSize)}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">letter-spacing</span><span class="info-list-item-value">${formatLetterSpacingTw(styles.letterSpacing)}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">text-align</span><span class="info-list-item-value">${formatTextAlignTw(styles.textAlign)}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">text-transform</span><span class="info-list-item-value">${formatTextTransformTw(styles.textTransform)}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">color</span><span class="info-list-item-value">${formatColorValue(styles.color)}</span></div>
      </div>
    </div>
  `;

  html += `
    <div class="info-section">
      <div class="info-section-title">Visual</div>
      <div class="info-list">
        <div class="info-list-item"><span class="info-list-item-label">background</span><span class="info-list-item-value">${formatColorValue(styles.backgroundColor)}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">opacity</span><span class="info-list-item-value">${formatOpacityTw(styles.opacity)}</span></div>
      </div>
    </div>
  `;

  html += `
    <div class="info-section">
      <div class="info-section-title">Layout</div>
      <div class="info-list">
        <div class="info-list-item"><span class="info-list-item-label">Display</span><span class="info-list-item-value">${formatCssValue(styles.display)}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">Position</span><span class="info-list-item-value">${formatCssValue(styles.position)}</span></div>
      </div>
    </div>
  `;

  if (parentContext) {
    html += `
      <div class="info-section">
        <div class="info-section-title">Parent context</div>
        <div class="info-list">
          <div class="info-list-item"><span class="info-list-item-label">Parent</span><span class="info-list-item-value">${escapeHtml(parentContext.label)}</span></div>
          <div class="info-list-item"><span class="info-list-item-label">Display</span><span class="info-list-item-value">${formatCssValue(parentContext.display)}</span></div>
          <div class="info-list-item"><span class="info-list-item-label">Direction</span><span class="info-list-item-value">${formatCssValue(parentContext.flexDirection || parentContext.gridFlow || '—')}</span></div>
          <div class="info-list-item"><span class="info-list-item-label">Align</span><span class="info-list-item-value">${formatCssValue(parentContext.alignItems || parentContext.justifyItems || '—')}</span></div>
          <div class="info-list-item"><span class="info-list-item-label">Justify</span><span class="info-list-item-value">${formatCssValue(parentContext.justifyContent || parentContext.justifyItems || '—')}</span></div>
          <div class="info-list-item"><span class="info-list-item-label">Gap</span><span class="info-list-item-value">${formatSizeTw(parentContext.gap, 'gap')}</span></div>
        </div>
      </div>
    `;
  }

  if (styles.display === 'flex') {
    html += `
      <div class="info-section">
        <div class="info-section-title">Flex container</div>
        <div class="info-list">
          <div class="info-list-item"><span class="info-list-item-label">flex-direction</span><span class="info-list-item-value">${formatCssValue(styles.flexDirection)}</span></div>
          <div class="info-list-item"><span class="info-list-item-label">flex-wrap</span><span class="info-list-item-value">${formatCssValue(styles.flexWrap)}</span></div>
          <div class="info-list-item"><span class="info-list-item-label">justify-content</span><span class="info-list-item-value">${formatCssValue(styles.justifyContent)}</span></div>
          <div class="info-list-item"><span class="info-list-item-label">align-items</span><span class="info-list-item-value">${formatCssValue(styles.alignItems)}</span></div>
        </div>
      </div>
    `;
  }

  const hasFlexItem = styles.flexGrow !== '0' || styles.flexShrink !== '1' || styles.flexBasis !== 'auto' || styles.alignSelf !== 'auto' || styles.order !== '0';
  if (hasFlexItem) {
    html += `
      <div class="info-section">
        <div class="info-section-title">Flex item</div>
        <div class="info-list">
          <div class="info-list-item"><span class="info-list-item-label">flex-grow</span><span class="info-list-item-value">${formatCssValue(styles.flexGrow)}</span></div>
          <div class="info-list-item"><span class="info-list-item-label">flex-shrink</span><span class="info-list-item-value">${formatCssValue(styles.flexShrink)}</span></div>
          <div class="info-list-item"><span class="info-list-item-label">flex-basis</span><span class="info-list-item-value">${formatSizeTw(styles.flexBasis, 'basis')}</span></div>
          <div class="info-list-item"><span class="info-list-item-label">align-self</span><span class="info-list-item-value">${formatCssValue(styles.alignSelf)}</span></div>
          <div class="info-list-item"><span class="info-list-item-label">order</span><span class="info-list-item-value">${formatCssValue(styles.order)}</span></div>
        </div>
      </div>
    `;
  }

  if (styles.display === 'grid') {
    html += `
      <div class="info-section">
        <div class="info-section-title">Grid container</div>
        <div class="info-list">
          <div class="info-list-item"><span class="info-list-item-label">grid-template-columns</span><span class="info-list-item-value code-value">${escapeHtml(styles.gridTemplateColumns || '—')}</span></div>
          <div class="info-list-item"><span class="info-list-item-label">grid-template-rows</span><span class="info-list-item-value code-value">${escapeHtml(styles.gridTemplateRows || '—')}</span></div>
          <div class="info-list-item"><span class="info-list-item-label">gap</span><span class="info-list-item-value">${formatSizeTw(styles.gap, 'gap')}</span></div>
        </div>
      </div>
    `;
  }

  const hasGridItem =
    (styles.gridColumnStart && styles.gridColumnStart !== 'auto') ||
    (styles.gridRowStart && styles.gridRowStart !== 'auto') ||
    (styles.justifySelf && styles.justifySelf !== 'auto') ||
    (styles.alignSelf && styles.alignSelf !== 'auto');

  if (hasGridItem) {
    html += `
      <div class="info-section">
        <div class="info-section-title">Grid item</div>
        <div class="info-list">
          <div class="info-list-item"><span class="info-list-item-label">grid-column</span><span class="info-list-item-value">${formatCssValue(styles.gridColumnStart)} / ${formatCssValue(styles.gridColumnEnd)}</span></div>
          <div class="info-list-item"><span class="info-list-item-label">grid-row</span><span class="info-list-item-value">${formatCssValue(styles.gridRowStart)} / ${formatCssValue(styles.gridRowEnd)}</span></div>
          <div class="info-list-item"><span class="info-list-item-label">justify-self</span><span class="info-list-item-value">${formatCssValue(styles.justifySelf)}</span></div>
          <div class="info-list-item"><span class="info-list-item-label">align-self</span><span class="info-list-item-value">${formatCssValue(styles.alignSelf)}</span></div>
        </div>
      </div>
    `;
  }

  const hasConstraints =
    (styles.minWidth && styles.minWidth !== '0px' && styles.minWidth !== 'auto') ||
    (styles.minHeight && styles.minHeight !== '0px' && styles.minHeight !== 'auto') ||
    (styles.maxWidth && styles.maxWidth !== 'none') ||
    (styles.maxHeight && styles.maxHeight !== 'none');

  if (hasConstraints) {
    html += `
      <div class="info-section">
        <div class="info-section-title">Constraints</div>
        <div class="info-list">
          <div class="info-list-item"><span class="info-list-item-label">min-width</span><span class="info-list-item-value">${formatSizeTw(styles.minWidth, 'min-w')}</span></div>
          <div class="info-list-item"><span class="info-list-item-label">min-height</span><span class="info-list-item-value">${formatSizeTw(styles.minHeight, 'min-h')}</span></div>
          <div class="info-list-item"><span class="info-list-item-label">max-width</span><span class="info-list-item-value">${formatSizeTw(styles.maxWidth, 'max-w')}</span></div>
          <div class="info-list-item"><span class="info-list-item-label">max-height</span><span class="info-list-item-value">${formatSizeTw(styles.maxHeight, 'max-h')}</span></div>
        </div>
      </div>
    `;
  }

  content.innerHTML = html;
}

function escapeHtml(value) {
  if (value == null) return '';
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}
