// Layout Debugger Content Script
class LayoutDebugger {
  constructor () {
    this.isActive = false;
    this.showBorders = false;
    this.lineStyle = 'solid'; // 'solid' | 'dotted'
    this.selectedElement = null;
    this.borderStyleSheet = null;
    this.labelElements = new Map();
    this.observer = null;
    this.updateHandler = null;
    this.scrollListener = null;
    this.resizeListener = null;
    this.clickHandler = null;
    this.hoveredElement = null;
    this.mouseEnterHandler = null;
    this.mouseLeaveHandler = null;

    this.init();
  }

  init() {
    this.createStyleSheet();
  }

  createStyleSheet() {
    // Create a style sheet for border overlays
    this.borderStyleSheet = document.createElement('style');
    this.borderStyleSheet.id = 'layout-debugger-styles';
    document.head.appendChild(this.borderStyleSheet);
  }

  // Simple selector for copy (tag#id or tag.class1.class2)
  getSelector(element) {
    const tag = element.tagName.toLowerCase();
    if (element.id && /^[a-zA-Z][\w-]*$/.test(element.id)) {
      return `${tag}#${element.id}`;
    }
    const classes = this.getElementClasses(element);
    if (classes.length > 0) {
      const safe = classes.slice(0, 3).map(c => /^[a-zA-Z][\w-]*$/.test(c) ? `.${c}` : '').filter(Boolean).join('');
      return safe ? `${tag}${safe}` : tag;
    }
    return tag;
  }

  sendElementDataToSidebar(element) {
    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);
    const rootStyles = window.getComputedStyle(document.documentElement);
    const classes = this.getElementClasses(element);
    const color = this.getElementColor(element);

    const rootFontSize = parseFloat(rootStyles.fontSize) || 16;
    const elementFontSize = parseFloat(styles.fontSize) || rootFontSize;

    const elementData = {
      tag: element.tagName.toLowerCase(),
      id: element.id || '',
      classes: classes,
      color: color,
      selector: this.getSelector(element),
      rootFontSize,
      elementFontSize,
      rect: {
        width: rect.width,
        height: rect.height,
        left: rect.left,
        top: rect.top
      },
      styles: {
        marginTop: styles.marginTop,
        marginRight: styles.marginRight,
        marginBottom: styles.marginBottom,
        marginLeft: styles.marginLeft,
        paddingTop: styles.paddingTop,
        paddingRight: styles.paddingRight,
        paddingBottom: styles.paddingBottom,
        paddingLeft: styles.paddingLeft,
        borderTop: styles.borderTopWidth,
        borderRight: styles.borderRightWidth,
        borderBottom: styles.borderBottomWidth,
        borderLeft: styles.borderLeftWidth,
        boxSizing: styles.boxSizing,
        display: styles.display,
        position: styles.position,
        overflow: styles.overflow,
        overflowX: styles.overflowX,
        overflowY: styles.overflowY,
        zIndex: styles.zIndex,
        flexDirection: styles.flexDirection,
        flexWrap: styles.flexWrap,
        justifyContent: styles.justifyContent,
        alignItems: styles.alignItems,
        flexGrow: styles.flexGrow,
        flexShrink: styles.flexShrink,
        flexBasis: styles.flexBasis,
        alignSelf: styles.alignSelf,
        order: styles.order,
        gridTemplateColumns: styles.gridTemplateColumns,
        gridTemplateRows: styles.gridTemplateRows,
        gap: styles.gap,
        gridColumnStart: styles.gridColumnStart,
        gridColumnEnd: styles.gridColumnEnd,
        gridRowStart: styles.gridRowStart,
        gridRowEnd: styles.gridRowEnd,
        justifySelf: styles.justifySelf,
        alignSelf: styles.alignSelf,
        minWidth: styles.minWidth,
        minHeight: styles.minHeight,
        maxWidth: styles.maxWidth,
        maxHeight: styles.maxHeight
      }
    };

    chrome.runtime.sendMessage({
      action: 'elementSelected',
      data: elementData
    }).catch(err => {
      console.log('Could not send element data to sidebar:', err);
    });
  }

  setupClickHandler() {
    if (this.clickHandler) return;

    this.clickHandler = (e) => {
      // Don't intercept clicks on labels
      if (e.target.classList.contains('layout-debugger-label')) {
        return;
      }

      // Only handle clicks if borders are active
      if (!this.showBorders) {
        return;
      }

      // Find the actual element (might be clicking on a border)
      let element = e.target;

      // Skip certain elements
      const skipTags = ['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'HEAD', 'NOSCRIPT'];
      if (skipTags.includes(element.tagName)) {
        return;
      }

      // Select element for inspection (don't prevent default to allow normal clicks)
      // Use setTimeout to allow the click to proceed normally
      setTimeout(() => {
        // If clicking on an element with debugger border, use that element
        if (element.hasAttribute('data-layout-debugger')) {
          this.selectElement(element);
        } else {
          // Find parent with debugger attribute, or use the element itself
          const parent = element.closest('[data-layout-debugger]');
          if (parent) {
            this.selectElement(parent);
          } else {
            this.selectElement(element);
          }
        }
      }, 0);
    };

    document.addEventListener('click', this.clickHandler, true);
  }

  setupHoverHighlight() {
    if (this.mouseEnterHandler) return;

    this.mouseEnterHandler = (e) => {
      if (!this.showBorders) return;
      let el = e.target;
      const skip = ['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'HEAD', 'NOSCRIPT'];
      if (skip.includes(el.tagName)) return;
      if (!el.hasAttribute?.('data-layout-debugger')) {
        el = el.closest?.('[data-layout-debugger]') || el;
      }
      if (!el || el === this.hoveredElement) return;
      if (el.hasAttribute('data-layout-debugger-selected')) return;
      this.clearHoverHighlight();
      this.hoveredElement = el;
      el.setAttribute('data-layout-debugger-hover', 'true');
      el.style.setProperty('outline', '2px solid #3498db', 'important');
      el.style.setProperty('outline-offset', '1px', 'important');
    };

    this.mouseLeaveHandler = (e) => {
      const el = e.target;
      if (el.hasAttribute?.('data-layout-debugger-hover')) {
        this.clearHoverHighlight();
      }
    };

    document.addEventListener('mouseover', this.mouseEnterHandler, true);
    document.addEventListener('mouseout', this.mouseLeaveHandler, true);
  }

  clearHoverHighlight() {
    if (!this.hoveredElement) return;
    const el = this.hoveredElement;
    el.removeAttribute('data-layout-debugger-hover');
    if (!el.hasAttribute('data-layout-debugger-selected')) {
      const style = this.lineStyle === 'dotted' ? 'dotted' : 'solid';
      el.style.setProperty('outline', `1px ${style} #e74c3c`, 'important');
      el.style.removeProperty('outline-offset');
    }
    this.hoveredElement = null;
  }

  removeHoverHighlight() {
    if (this.mouseEnterHandler) {
      document.removeEventListener('mouseover', this.mouseEnterHandler, true);
      this.mouseEnterHandler = null;
    }
    if (this.mouseLeaveHandler) {
      document.removeEventListener('mouseout', this.mouseLeaveHandler, true);
      this.mouseLeaveHandler = null;
    }
    this.clearHoverHighlight();
  }

  removeClickHandler() {
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler, true);
      this.clickHandler = null;
    }
  }

  selectElement(element) {
    this.selectedElement = element;

    // Send element data to sidebar
    this.sendElementDataToSidebar(element);

    // Highlight selected element
    this.highlightSelectedElement(element);
  }

  highlightSelectedElement(element) {
    // Remove previous highlight
    const previous = document.querySelector('[data-layout-debugger-selected="true"]');
    if (previous) {
      previous.removeAttribute('data-layout-debugger-selected');
      previous.style.removeProperty('outline');
      previous.style.removeProperty('outline-offset');
    }

    // Add highlight to selected element
    if (element) {
      element.setAttribute('data-layout-debugger-selected', 'true');
      element.style.setProperty('outline', '3px solid #ff6b6b', 'important');
      element.style.setProperty('outline-offset', '2px', 'important');
    }
  }

  // Generate a color based on class name
  getColorForClass(className) {
    if (!className || className.trim() === '') {
      return '#007bff'; // Default blue
    }

    // Hash the class name to get a consistent color
    let hash = 0;
    for (let i = 0; i < className.length; i++) {
      hash = className.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Generate a color from the hash
    const hue = Math.abs(hash % 360);
    const saturation = 60 + (Math.abs(hash) % 20); // 60-80%
    const lightness = 45 + (Math.abs(hash) % 15); // 45-60%

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  // Get all classes from an element
  getElementClasses(element) {
    if (!element.className) return [];
    if (typeof element.className === 'string') {
      return element.className.split(' ').filter(c => c.trim());
    }
    // Handle classList
    return Array.from(element.classList || []);
  }

  // Get element identifier (tag + classes)
  getElementIdentifier(element) {
    const tag = element.tagName.toLowerCase();
    const classes = this.getElementClasses(element);
    const classStr = classes.length > 0 ? `.${classes.join('.')}` : '';
    return `${tag}${classStr}`;
  }

  // Get color for element based on its classes
  getElementColor(element) {
    const classes = this.getElementClasses(element);
    if (classes.length > 0) {
      // Use the first class for color, or combine all classes
      const primaryClass = classes[0];
      return this.getColorForClass(primaryClass);
    }
    // Use tag name if no classes
    return this.getColorForClass(element.tagName.toLowerCase());
  }

  // Create label element for an element
  createLabel(element) {
    const rect = element.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    // Skip if element is too small or not visible
    if (rect.width < 5 || rect.height < 5 || rect.width === 0 || rect.height === 0) {
      return null;
    }

    const label = document.createElement('div');
    label.className = 'layout-debugger-label';

    const tag = element.tagName.toLowerCase();
    const classes = this.getElementClasses(element);
    const classStr = classes.length > 0 ? `.${classes.slice(0, 2).join('.')}` : '';
    const labelText = `${tag}${classStr}`;

    const color = this.getElementColor(element);

    label.textContent = labelText;
    label.style.cssText = `
      position: absolute;
      left: ${rect.left + scrollX}px;
      top: ${rect.top + scrollY - 18}px;
      background: ${color};
      color: white;
      padding: 2px 6px;
      font-size: 10px;
      font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
      font-weight: bold;
      white-space: nowrap;
      pointer-events: none;
      z-index: 999998;
      border-radius: 3px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      line-height: 1.2;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
    `;

    // Adjust if label goes off screen
    if (rect.left + scrollX < 0) {
      label.style.left = `${scrollX}px`;
    }
    if (rect.top + scrollY < 18) {
      label.style.top = `${rect.top + scrollY + rect.height + 2}px`;
    }

    document.body.appendChild(label);
    return label;
  }

  // Add borders and labels to all elements
  addBordersToElements() {
    // Remove existing labels and borders
    this.removeAllLabels();
    this.removeAllBorders();

    // Elements to skip
    const skipTags = ['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'HEAD', 'NOSCRIPT', 'SVG', 'PATH', 'G', 'CIRCLE', 'RECT'];
    const skipClasses = ['layout-debugger-label'];

    // Get all elements
    const allElements = document.querySelectorAll('*');
    const elementsToStyle = [];

    allElements.forEach(element => {
      // Skip certain elements
      if (skipTags.includes(element.tagName)) return;
      if (skipClasses.some(cls => element.classList.contains(cls))) return;
      if (element === document.body || element === document.documentElement) return;
      if (element.id === 'layout-debugger-styles' || element.id === 'layout-debugger-sidebar') return;

      const rect = element.getBoundingClientRect();
      const styles = window.getComputedStyle(element);

      // Skip invisible elements
      if (styles.display === 'none' || styles.visibility === 'hidden' || styles.opacity === '0') return;
      if (rect.width === 0 && rect.height === 0) return;

      elementsToStyle.push(element);
    });

    const outlineColor = '#e74c3c';
    const style = this.lineStyle === 'dotted' ? 'dotted' : 'solid';

    elementsToStyle.forEach((element) => {
      element.setAttribute('data-layout-debugger', 'true');

      if (!element.hasAttribute('data-layout-debugger-original-outline')) {
        const originalOutline = element.style.outline || '';
        element.setAttribute('data-layout-debugger-original-outline', originalOutline);
      }

      element.style.setProperty('outline', `1px ${style} ${outlineColor}`, 'important');
    });

    this.borderStyleSheet.textContent = '';
  }

  // Remove all borders (outlines)
  removeAllBorders() {
    const elements = document.querySelectorAll('[data-layout-debugger="true"]');
    elements.forEach(element => {
      element.style.removeProperty('outline');

      const originalOutline = element.getAttribute('data-layout-debugger-original-outline');
      if (originalOutline && originalOutline !== '') {
        element.style.outline = originalOutline;
      }

      element.removeAttribute('data-layout-debugger');
      element.removeAttribute('data-layout-debugger-original-outline');
    });

    // Clear the stylesheet content
    if (this.borderStyleSheet) {
      this.borderStyleSheet.textContent = '';
    }

    // Also remove selected element highlight
    const selected = document.querySelector('[data-layout-debugger-selected="true"]');
    if (selected) {
      selected.removeAttribute('data-layout-debugger-selected');
      selected.style.removeProperty('outline');
      selected.style.removeProperty('outline-offset');
    }
  }

  // Remove all labels
  removeAllLabels() {
    this.labelElements.forEach(label => {
      if (label && label.parentNode) {
        label.parentNode.removeChild(label);
      }
    });
    this.labelElements.clear();

    // Also remove any orphaned labels
    const existingLabels = document.querySelectorAll('.layout-debugger-label');
    existingLabels.forEach(label => label.remove());
  }

  // Update labels position (for scroll/resize)
  updateLabels() {
    if (!this.showBorders) return;

    this.labelElements.forEach((label, element) => {
      if (!document.body.contains(element)) {
        label.remove();
        this.labelElements.delete(element);
        return;
      }

      const rect = element.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;

      if (rect.width === 0 && rect.height === 0) {
        label.style.display = 'none';
        return;
      }

      label.style.display = 'block';
      label.style.left = `${rect.left + scrollX}px`;
      label.style.top = `${rect.top + scrollY - 18}px`;

      if (rect.top + scrollY < 18) {
        label.style.top = `${rect.top + scrollY + rect.height + 2}px`;
      }
    });
  }

  // Setup observers and listeners
  setupObservers() {
    // Update labels on scroll/resize
    let updateTimeout;
    this.updateHandler = () => {
      clearTimeout(updateTimeout);
      updateTimeout = setTimeout(() => {
        this.updateLabels();
      }, 50);
    };

    this.scrollListener = this.updateHandler;
    this.resizeListener = this.updateHandler;

    window.addEventListener('scroll', this.scrollListener, true);
    window.addEventListener('resize', this.resizeListener);

    // Watch for DOM changes
    this.observer = new MutationObserver((mutations) => {
      if (this.showBorders) {
        let shouldUpdate = false;
        mutations.forEach(mutation => {
          if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
            shouldUpdate = true;
          }
        });

        if (shouldUpdate) {
          // Debounce DOM updates
          clearTimeout(updateTimeout);
          updateTimeout = setTimeout(() => {
            this.addBordersToElements();
          }, 150);
        }
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false
    });
  }

  // Cleanup observers
  cleanupObservers() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener, true);
      this.scrollListener = null;
    }
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
      this.resizeListener = null;
    }
    this.updateHandler = null;
  }

  setLineStyle(style) {
    if (style !== 'solid' && style !== 'dotted') return;
    this.lineStyle = style;
    if (this.showBorders) {
      this.addBordersToElements();
    }
  }

  // Activate border mode
  activateBorders(lineStyle) {
    if (this.showBorders) return; // Already active
    if (lineStyle === 'dotted' || lineStyle === 'solid') {
      this.lineStyle = lineStyle;
    }
    this.showBorders = true;
    this.addBordersToElements();
    this.setupObservers();
    this.setupClickHandler();
    this.setupHoverHighlight();
  }

  // Deactivate border mode
  deactivateBorders() {
    if (!this.showBorders) return; // Already inactive

    this.showBorders = false;
    this.removeHoverHighlight();
    this.borderStyleSheet.textContent = '';
    this.removeAllLabels();
    this.removeAllBorders();
    this.cleanupObservers();
    this.removeClickHandler();
  }

  // Toggle borders (optionally pass lineStyle: 'solid' | 'dotted')
  toggleBorders(lineStyle) {
    if (this.showBorders) {
      this.deactivateBorders();
    } else {
      this.activateBorders(lineStyle);
    }
    return this.showBorders;
  }
}

// Initialize debugger
let debuggerInstance = null;

// Initialize debugger when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!debuggerInstance) {
      debuggerInstance = new LayoutDebugger();
    }
  });
} else {
  // DOM is already ready
  if (!debuggerInstance) {
    debuggerInstance = new LayoutDebugger();
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Ensure instance exists
  if (!debuggerInstance) {
    debuggerInstance = new LayoutDebugger();
  }

  switch (request.action) {
    case 'ping':
      // Health check to see if content script is loaded
      sendResponse({ success: true });
      break;

    case 'toggleBorders':
      const lineStyle = request.lineStyle || debuggerInstance.lineStyle;
      const bordersActive = debuggerInstance.toggleBorders(lineStyle);
      sendResponse({ success: true, active: bordersActive, lineStyle: debuggerInstance.lineStyle });
      break;

    case 'setLineStyle':
      debuggerInstance.setLineStyle(request.lineStyle);
      sendResponse({ success: true, lineStyle: debuggerInstance.lineStyle });
      break;

    case 'getState':
      sendResponse({
        showBorders: debuggerInstance.showBorders,
        lineStyle: debuggerInstance.lineStyle
      });
      break;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }

  return true; // Keep the message channel open for async response
});
