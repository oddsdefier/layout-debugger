// Popup Script
let showBorders = false;
let currentTabId = null;
let lastInspectorData = null;

document.addEventListener('DOMContentLoaded', async () => {
  const toggleBordersBtn = document.getElementById('toggleBordersBtn');
  const closeSidebarBtn = document.getElementById('closeSidebarBtn');

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab.id;

  // Check if we can run on this page
  const canRun = await checkIfPageSupported(tab);
  if (!canRun) {
    showUnsupportedPageMessage();
    return;
  }

  // Ensure content script is loaded
  await ensureContentScriptLoaded(tab.id);

  // Load state (borders + line style + size unit)
  await loadState(tab.id);
  loadLineStyleFromStorage();
  loadSizeUnitFromStorage();

  // Show current page status
  showPageStatus(tab);

  // Listen for element selection messages from content script
  setupMessageListener();

  // Close sidebar button
  closeSidebarBtn.addEventListener('click', () => {
    window.close();
  });

  // Toggle borders button
  toggleBordersBtn.addEventListener('click', async () => {
    await toggleBorders(tab.id);
  });

  // Line style radios
  document.querySelectorAll('input[name="lineStyle"]').forEach((radio) => {
    radio.addEventListener('change', async (e) => {
      const lineStyle = e.target.value;
      await saveLineStyleToStorage(lineStyle);
      await setLineStyleInTab(tab.id, lineStyle);
    });
  });

  // Size unit radios — re-render inspector with new unit when changed
  document.querySelectorAll('input[name="sizeUnit"]').forEach((radio) => {
    radio.addEventListener('change', async (e) => {
      const sizeUnit = e.target.value;
      await saveSizeUnitToStorage(sizeUnit);
      if (lastInspectorData) updateInspector(lastInspectorData);
    });
  });

  // Copy buttons (delegated when inspector content exists)
  document.getElementById('copySelectorBtn')?.addEventListener('click', copySelector);
  document.getElementById('copyDimensionsBtn')?.addEventListener('click', copyDimensions);
});

async function ensureContentScriptLoaded(tabId) {
  try {
    // Try to ping the content script
    const response = await sendMessage(tabId, 'ping');
    if (response && response.success) {
      return true;
    }
  } catch (error) {
    // Content script not loaded, inject it
    try {
      await injectScripts(tabId);
      // Wait for script to initialize
      await new Promise(resolve => setTimeout(resolve, 150));
      return true;
    } catch (injectError) {
      console.error('Error injecting content script:', injectError);
      return false;
    }
  }
  return false;
}

function getSelectedLineStyle() {
  const checked = document.querySelector('input[name="lineStyle"]:checked');
  return (checked && checked.value) || 'solid';
}

async function toggleBorders(tabId) {
  try {
    const lineStyle = getSelectedLineStyle();
    const response = await sendMessage(tabId, 'toggleBorders', { lineStyle });
    if (response && response.success) {
      showBorders = response.active;
      updateBordersButton();
      saveState();
    }
  } catch (error) {
    console.error('Error toggling borders:', error);
    showErrorMessage('Failed to toggle borders. Please try again.');
  }
}

async function setLineStyleInTab(tabId, lineStyle) {
  try {
    await sendMessage(tabId, 'setLineStyle', { lineStyle });
  } catch (error) {
    console.error('Error setting line style:', error);
  }
}

function loadLineStyleFromStorage() {
  chrome.storage.local.get(['layoutDebuggerLineStyle'], (result) => {
    const lineStyle = result.layoutDebuggerLineStyle || 'solid';
    const radio = document.querySelector(`input[name="lineStyle"][value="${lineStyle}"]`);
    if (radio) radio.checked = true;
  });
}

function saveLineStyleToStorage(lineStyle) {
  chrome.storage.local.set({ layoutDebuggerLineStyle: lineStyle });
}

function getSelectedSizeUnit() {
  const checked = document.querySelector('input[name="sizeUnit"]:checked');
  return (checked && checked.value) || 'px';
}

function loadSizeUnitFromStorage() {
  chrome.storage.local.get(['layoutDebuggerSizeUnit'], (result) => {
    const sizeUnit = result.layoutDebuggerSizeUnit || 'px';
    const radio = document.querySelector(`input[name="sizeUnit"][value="${sizeUnit}"]`);
    if (radio) radio.checked = true;
  });
}

function saveSizeUnitToStorage(sizeUnit) {
  chrome.storage.local.set({ layoutDebuggerSizeUnit: sizeUnit });
}


async function injectScripts(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  });
  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ['content.css']
  });
}

async function sendMessage(tabId, action, payload = {}) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action, ...payload });
    return response;
  } catch (error) {
    throw error;
  }
}

function updateBordersButton() {
  const toggleBtn = document.getElementById('toggleBordersBtn');
  const btnText = toggleBtn.querySelector('.btn-text');
  const btnIcon = toggleBtn.querySelector('.btn-icon');

  if (showBorders) {
    toggleBtn.classList.add('active');
    btnText.textContent = 'Hide Borders';
    btnIcon.textContent = '✖';
  } else {
    toggleBtn.classList.remove('active');
    btnText.textContent = 'Show Borders';
    btnIcon.textContent = '📦';
  }
}


async function loadState(tabId) {
  try {
    const response = await sendMessage(tabId, 'getState');
    if (response && response.showBorders !== undefined) {
      showBorders = response.showBorders;
      updateBordersButton();
    }
    if (response && response.lineStyle) {
      const radio = document.querySelector(`input[name="lineStyle"][value="${response.lineStyle}"]`);
      if (radio) radio.checked = true;
    }
  } catch (error) {
    showBorders = false;
    updateBordersButton();
  }
}

function saveState() {
  chrome.storage.local.set({
    layoutDebuggerBorders: showBorders,
    layoutDebuggerLineStyle: getSelectedLineStyle(),
    layoutDebuggerSizeUnit: getSelectedSizeUnit()
  });
}

function showPageStatus(tab) {
  const pageStatus = document.getElementById('pageStatus');
  if (!pageStatus || !tab || !tab.url) return;
  
  try {
    const url = new URL(tab.url);
    const displayUrl = url.hostname + url.pathname;
    const truncatedUrl = displayUrl.length > 50 ? displayUrl.substring(0, 47) + '...' : displayUrl;
    
    pageStatus.innerHTML = `<strong>Active on:</strong> ${truncatedUrl}`;
  } catch (error) {
    pageStatus.innerHTML = `<strong>Active on:</strong> Current page`;
  }
}

function checkIfPageSupported(tab) {
  // Check if the URL is supported
  if (!tab || !tab.url) return false;
  
  const url = tab.url;
  
  // Allow about:blank specifically
  if (url === 'about:blank') {
    return true;
  }
  
  // Only block chrome-extension:// pages - allow chrome:// pages with HTML
  const unsupportedProtocols = ['chrome-extension://', 'about:', 'view-source:', 'data:'];
  
  // Check if URL starts with any unsupported protocol
  for (const protocol of unsupportedProtocols) {
    if (url.startsWith(protocol)) {
      return false;
    }
  }
  
  // Check for Chrome Web Store and other restricted domains
  const restrictedDomains = [
    'chrome.google.com/webstore',
    'chromewebstore.google.com',
    'microsoftedge.microsoft.com/addons'
  ];
  
  for (const domain of restrictedDomains) {
    if (url.includes(domain)) {
      return false;
    }
  }
  
  // Check for PDF files
  if (url.endsWith('.pdf') || url.includes('.pdf#')) {
    return false;
  }
  
  return true;
}

function showUnsupportedPageMessage() {
  const container = document.querySelector('.container');
  container.innerHTML = `
    <header>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
        <div style="flex: 1;">
          <h1>Layout Debugger</h1>
          <p class="subtitle">Visualize element borders and labels</p>
        </div>
        <button id="closeSidebarBtn" class="close-btn" title="Close sidebar">✕</button>
      </div>
    </header>
    
    <div style="text-align: center; padding: 40px 20px;">
      <div style="font-size: 64px; margin-bottom: 20px;">🚫</div>
      <h2 style="color: #e74c3c; margin-bottom: 16px; font-size: 20px;">Page Not Supported</h2>
      <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
        This extension cannot run on this page due to browser restrictions.
      </p>
      <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; text-align: left;">
        <p style="color: #495057; font-size: 14px; line-height: 1.6; margin-bottom: 12px;">
          <strong style="color: #667eea;">Unsupported pages include:</strong>
        </p>
        <ul style="color: #666; font-size: 13px; line-height: 1.8; padding-left: 20px;">
          <li>Extension pages (chrome-extension://)</li>
          <li>Chrome Web Store and extension stores</li>
          <li>PDF files (.pdf)</li>
          <li>About pages (except about:blank)</li>
          <li>View source pages (view-source:)</li>
          <li>Data URLs (data:)</li>
        </ul>
        <p style="color: #495057; font-size: 14px; line-height: 1.6; margin-top: 16px;">
          <strong style="color: #667eea;">Try:</strong> Navigate to a regular website (http:// or https://)
        </p>
      </div>
    </div>
  `;
  
  // Re-attach close button handler
  const closeSidebarBtn = document.getElementById('closeSidebarBtn');
  if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener('click', () => {
      window.close();
    });
  }
}

function showErrorMessage(message) {
  // Create error notification
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
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    errorDiv.style.animation = 'slideUp 0.3s ease';
    setTimeout(() => {
      errorDiv.remove();
    }, 300);
  }, 5000);
}

// Add animation styles
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

function copySelector() {
  if (!lastInspectorData?.selector) return;
  navigator.clipboard.writeText(lastInspectorData.selector).then(() => {
    const btn = document.getElementById('copySelectorBtn');
    if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy selector'; }, 1500); }
  });
}

function copyDimensions() {
  if (!lastInspectorData) return;
  const { rect, styles, rootFontSize, elementFontSize } = lastInspectorData;
  const unit = getSelectedSizeUnit();
  const root = rootFontSize ?? 16;
  const emBase = elementFontSize ?? root;
  const size = (v) => {
    if (v == null || v === '') return '';
    const s = String(v).trim();
    if (s === 'auto' || s === 'inherit' || s === 'initial') return s;
    const num = typeof v === 'number' ? v : parseFloat(v);
    return isNaN(num) ? s : formatSize(num, root, emBase, unit);
  };
  const lines = [
    `width: ${size(rect.width)}; height: ${size(rect.height)};`,
    `margin: ${size(styles.marginTop)} ${size(styles.marginRight)} ${size(styles.marginBottom)} ${size(styles.marginLeft)};`,
    `padding: ${size(styles.paddingTop)} ${size(styles.paddingRight)} ${size(styles.paddingBottom)} ${size(styles.paddingLeft)};`,
    `box-sizing: ${styles.boxSizing};`
  ];
  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    const btn = document.getElementById('copyDimensionsBtn');
    if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy dimensions'; }, 1500); }
  });
}

function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'elementSelected' && sender.tab.id === currentTabId) {
      lastInspectorData = message.data;
      updateInspector(message.data);
      sendResponse({ success: true });
    }
    return true;
  });
}

function formatCssValue(val) {
  if (val == null || val === '') return '—';
  const s = String(val).trim();
  if (s === '0px' || s === '0') return '0';
  return s;
}

// Convert a px value (number or "Npx" string) to the selected unit for display
function formatSize(pxValue, rootFontSize, elementFontSize, unit) {
  if (pxValue == null || pxValue === '') return '—';
  const s = String(pxValue).trim();
  if (s === 'auto' || s === 'inherit' || s === 'initial' || s === 'none') return s;
  const num = typeof pxValue === 'number' ? pxValue : parseFloat(s);
  if (isNaN(num)) return s;
  const root = rootFontSize || 16;
  const emBase = elementFontSize || root;
  if (unit === 'rem') return (num / root).toFixed(4).replace(/\.?0+$/, '') + 'rem';
  if (unit === 'em') return (num / emBase).toFixed(4).replace(/\.?0+$/, '') + 'em';
  return Math.round(num) + 'px';
}

function updateInspector(elementData) {
  const content = document.getElementById('inspectorContent');
  const copyActions = document.getElementById('inspectorCopyActions');
  if (!content) return;

  copyActions.style.display = 'flex';

  const { tag, id, classes, color, selector, rect, styles, rootFontSize, elementFontSize } = elementData;
  const unit = getSelectedSizeUnit();
  const root = rootFontSize ?? 16;
  const emBase = elementFontSize ?? root;

  const size = (v) => {
    if (v == null || v === '') return '—';
    const s = String(v).trim();
    if (s === 'auto' || s === 'inherit' || s === 'initial' || s === 'none') return s;
    const num = typeof v === 'number' ? v : parseFloat(v);
    return isNaN(num) ? s : formatSize(num, root, emBase, unit);
  };

  let html = `
    <div class="element-tag">
      <div class="element-color" style="background: ${color};"></div>
      <div class="element-name">
        <span class="tag">${tag}</span>
        ${id ? `<span class="id">#${id}</span>` : ''}
        ${classes.length > 0 ? `<span class="class">.${classes.join('.')}</span>` : ''}
      </div>
    </div>
    <div class="selector-line"><code class="selector-code">${escapeHtml(selector || '')}</code></div>

    <div class="info-section">
      <div class="info-section-title">Dimensions</div>
      <div class="info-grid">
        <div class="info-item"><div class="info-item-label">Width</div><div class="info-item-value">${size(rect.width)}</div></div>
        <div class="info-item"><div class="info-item-label">Height</div><div class="info-item-value">${size(rect.height)}</div></div>
        <div class="info-item"><div class="info-item-label">X</div><div class="info-item-value">${size(rect.left)}</div></div>
        <div class="info-item"><div class="info-item-label">Y</div><div class="info-item-value">${size(rect.top)}</div></div>
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
        <div class="info-list-item"><span class="info-list-item-label">Top</span><span class="info-list-item-value">${size(styles.marginTop)}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">Right</span><span class="info-list-item-value">${size(styles.marginRight)}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">Bottom</span><span class="info-list-item-value">${size(styles.marginBottom)}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">Left</span><span class="info-list-item-value">${size(styles.marginLeft)}</span></div>
      </div>
    </div>

    <div class="info-section">
      <div class="info-section-title">Padding</div>
      <div class="info-list">
        <div class="info-list-item"><span class="info-list-item-label">Top</span><span class="info-list-item-value">${size(styles.paddingTop)}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">Right</span><span class="info-list-item-value">${size(styles.paddingRight)}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">Bottom</span><span class="info-list-item-value">${size(styles.paddingBottom)}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">Left</span><span class="info-list-item-value">${size(styles.paddingLeft)}</span></div>
      </div>
    </div>
  `;

  if (styles.borderTop || styles.borderRight || styles.borderBottom || styles.borderLeft) {
    html += `
    <div class="info-section">
      <div class="info-section-title">Border (width)</div>
      <div class="info-list">
        <div class="info-list-item"><span class="info-list-item-label">Top</span><span class="info-list-item-value">${size(styles.borderTop)}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">Right</span><span class="info-list-item-value">${size(styles.borderRight)}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">Bottom</span><span class="info-list-item-value">${size(styles.borderBottom)}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">Left</span><span class="info-list-item-value">${size(styles.borderLeft)}</span></div>
      </div>
    </div>`;
  }

  html += `
    <div class="info-section">
      <div class="info-section-title">Layout</div>
      <div class="info-list">
        <div class="info-list-item"><span class="info-list-item-label">Display</span><span class="info-list-item-value">${styles.display}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">Position</span><span class="info-list-item-value">${styles.position}</span></div>
      </div>
    </div>`;

  if (styles.display === 'flex') {
    html += `
    <div class="info-section">
      <div class="info-section-title">Flex container</div>
      <div class="info-list">
        <div class="info-list-item"><span class="info-list-item-label">flex-direction</span><span class="info-list-item-value">${styles.flexDirection}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">flex-wrap</span><span class="info-list-item-value">${styles.flexWrap}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">justify-content</span><span class="info-list-item-value">${styles.justifyContent}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">align-items</span><span class="info-list-item-value">${styles.alignItems}</span></div>
      </div>
    </div>`;
  }

  const hasFlexItem = styles.flexGrow !== '0' || styles.flexShrink !== '1' || styles.flexBasis !== 'auto' || styles.alignSelf !== 'auto' || styles.order !== '0';
  if (hasFlexItem) {
    html += `
    <div class="info-section">
      <div class="info-section-title">Flex item</div>
      <div class="info-list">
        <div class="info-list-item"><span class="info-list-item-label">flex-grow</span><span class="info-list-item-value">${formatCssValue(styles.flexGrow)}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">flex-shrink</span><span class="info-list-item-value">${formatCssValue(styles.flexShrink)}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">flex-basis</span><span class="info-list-item-value">${size(styles.flexBasis)}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">align-self</span><span class="info-list-item-value">${formatCssValue(styles.alignSelf)}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">order</span><span class="info-list-item-value">${formatCssValue(styles.order)}</span></div>
      </div>
    </div>`;
  }

  if (styles.display === 'grid') {
    html += `
    <div class="info-section">
      <div class="info-section-title">Grid container</div>
      <div class="info-list">
        <div class="info-list-item"><span class="info-list-item-label">grid-template-columns</span><span class="info-list-item-value code-value">${escapeHtml(styles.gridTemplateColumns || '—')}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">grid-template-rows</span><span class="info-list-item-value code-value">${escapeHtml(styles.gridTemplateRows || '—')}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">gap</span><span class="info-list-item-value">${size(styles.gap)}</span></div>
      </div>
    </div>`;
  }

  const hasGridItem = (styles.gridColumnStart && styles.gridColumnStart !== 'auto') || (styles.gridRowStart && styles.gridRowStart !== 'auto') || (styles.justifySelf && styles.justifySelf !== 'auto') || (styles.alignSelf && styles.alignSelf !== 'auto');
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
    </div>`;
  }

  const hasConstraints = (styles.minWidth && styles.minWidth !== '0px' && styles.minWidth !== 'auto') || (styles.minHeight && styles.minHeight !== '0px' && styles.minHeight !== 'auto') || (styles.maxWidth && styles.maxWidth !== 'none') || (styles.maxHeight && styles.maxHeight !== 'none');
  if (hasConstraints) {
    html += `
    <div class="info-section">
      <div class="info-section-title">Constraints</div>
      <div class="info-list">
        <div class="info-list-item"><span class="info-list-item-label">min-width</span><span class="info-list-item-value">${size(styles.minWidth)}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">min-height</span><span class="info-list-item-value">${size(styles.minHeight)}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">max-width</span><span class="info-list-item-value">${size(styles.maxWidth)}</span></div>
        <div class="info-list-item"><span class="info-list-item-label">max-height</span><span class="info-list-item-value">${size(styles.maxHeight)}</span></div>
      </div>
    </div>`;
  }

  content.innerHTML = html;
}

function escapeHtml(s) {
  if (s == null) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
