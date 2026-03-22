// Layout Debugger Content Script
class LayoutDebugger {
  constructor () {
    this.isActive = false;
    this.showBorders = false;
    this.lineStyle = 'solid'; // 'solid' | 'dotted'
    this.selectedElement = null;
    this.borderStyleSheet = null;
    this.labelElements = new Map();
    this.trackedElements = new Set();
    this.originalOutlines = new WeakMap();
    this.originalBackgroundColors = new WeakMap();
    this.observer = null;
    this.updateHandler = null;
    this.scrollListener = null;
    this.resizeListener = null;
    this.clickHandler = null;
    this.hoveredElement = null;
    this.previewElement = null;
    this.mouseEnterHandler = null;
    this.mouseLeaveHandler = null;
    this.hoverInspectEnabled = true;
    this.monochromeEnabled = false;
    this.selectionRef = null;
    this.boxModelOverlay = null;
    this.monochromeOverlay = null;
    this.borderOpacity = 1;
    this.defaultLabelSettings = {
      showElement: true,
      showPadding: true,
      showMargin: false
    };
    this.labelSettings = { ...this.defaultLabelSettings };
    this.tailwindSpacingScale = new Map([
      [0, '0'],
      [2, '0.5'],
      [4, '1'],
      [6, '1.5'],
      [8, '2'],
      [10, '2.5'],
      [12, '3'],
      [14, '3.5'],
      [16, '4'],
      [20, '5'],
      [24, '6'],
      [28, '7'],
      [32, '8'],
      [36, '9'],
      [40, '10'],
      [44, '11'],
      [48, '12'],
      [56, '14'],
      [64, '16'],
      [80, '20'],
      [96, '24'],
      [112, '28'],
      [128, '32'],
      [144, '36'],
      [160, '40'],
      [176, '44'],
      [192, '48'],
      [208, '52'],
      [224, '56'],
      [240, '60'],
      [256, '64'],
      [288, '72'],
      [320, '80'],
      [384, '96']
    ]);

    this.init();
  }

  init() {
    this.createStyleSheet();
    this.createBoxModelOverlay();
    this.createMonochromeOverlay();
    this.setupObservers();
    this.setupClickHandler();
    this.setupHoverHighlight();
  }

  createStyleSheet() {
    // Create a style sheet for border overlays
    this.borderStyleSheet = document.createElement('style');
    this.borderStyleSheet.id = 'layout-debugger-styles';
    document.head.appendChild(this.borderStyleSheet);
  }

  createBoxModelOverlay() {
    const layer = document.createElement('div');
    layer.id = 'layout-debugger-box-model';
    layer.style.cssText = `
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 999997;
    `;

    const createPart = (name, background, border) => {
      const part = document.createElement('div');
      part.dataset.part = name;
      part.style.cssText = `
        position: fixed;
        box-sizing: border-box;
        pointer-events: none;
        display: none;
        background: ${background};
        border: none;
      `;
      layer.appendChild(part);
      return part;
    };

    this.boxModelOverlay = {
      layer,
      margin: createPart('margin', 'rgba(245, 158, 11, 0.18)', 'rgba(217, 119, 6, 0.45)'),
      border: createPart('border', 'rgba(239, 68, 68, 0.08)', 'rgba(239, 68, 68, 0.6)'),
      padding: createPart('padding', 'rgba(59, 130, 246, 0.12)', 'rgba(59, 130, 246, 0.45)'),
      content: createPart('content', 'rgba(16, 185, 129, 0.14)', 'rgba(5, 150, 105, 0.5)')
    };

    document.documentElement.appendChild(layer);
  }

  createMonochromeOverlay() {
    const layer = document.createElement('div');
    layer.id = 'layout-debugger-monochrome';
    layer.style.cssText = `
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 999996;
      display: none;
      backdrop-filter: grayscale(1) contrast(1.08);
      -webkit-backdrop-filter: grayscale(1) contrast(1.08);
      background: rgba(255, 255, 255, 0.02);
    `;
    document.documentElement.appendChild(layer);
    this.monochromeOverlay = layer;
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

  async sendElementDataToSidebar(element, mode = 'selected') {
    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);
    const classes = this.getElementClasses(element);
    const color = this.getElementColor(element);

    const elementData = {
      tag: element.tagName.toLowerCase(),
      id: element.id || '',
      classes: classes,
      color: color,
      selector: this.getSelector(element),
      mode,
      navigation: this.getNavigationState(element),
      parentContext: this.getParentContext(element),
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
        maxHeight: styles.maxHeight,
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
        lineHeight: styles.lineHeight,
        letterSpacing: styles.letterSpacing,
        textAlign: styles.textAlign,
        textTransform: styles.textTransform,
        color: styles.color,
        backgroundColor: styles.backgroundColor,
        opacity: styles.opacity,
        borderRadius: styles.borderRadius,
        borderTopLeftRadius: styles.borderTopLeftRadius,
        borderTopRightRadius: styles.borderTopRightRadius,
        borderBottomRightRadius: styles.borderBottomRightRadius,
        borderBottomLeftRadius: styles.borderBottomLeftRadius
      }
    };

    chrome.runtime.sendMessage({
      action: mode === 'hover' ? 'elementHovered' : 'elementSelected',
      data: elementData
    }).catch(err => {
      console.log('Could not send element data to sidebar:', err);
    });
  }

  notifyHoverCleared() {
    chrome.runtime.sendMessage({
      action: 'hoverCleared'
    }).catch(() => {});
  }

  setupClickHandler() {
    if (this.clickHandler) return;

    this.clickHandler = (e) => {
      // Don't intercept clicks on labels
      if (e.target.classList.contains('layout-debugger-label')) {
        return;
      }

      if (!this.hoverInspectEnabled) {
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
        if (!this.shouldInspectElement(element)) {
          let parent = element.parentElement;
          while (parent && !this.shouldInspectElement(parent)) {
            parent = parent.parentElement;
          }
          element = parent || element;
        }

        this.selectElement(element);
      }, 0);
    };

    document.addEventListener('click', this.clickHandler, true);
  }

  setupHoverHighlight() {
    if (this.mouseEnterHandler) return;

    this.mouseEnterHandler = (e) => {
      if (!this.hoverInspectEnabled) return;
      let el = e.target;
      const skip = ['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'HEAD', 'NOSCRIPT'];
      if (skip.includes(el.tagName)) return;

      if (!this.shouldInspectElement(el)) {
        let parent = el.parentElement;
        while (parent && !this.shouldInspectElement(parent)) {
          parent = parent.parentElement;
        }
        el = parent || el;
      }

      if (!el || el === this.hoveredElement) return;
      if (el === this.selectedElement) return;
      this.clearHoverHighlight();
      this.hoveredElement = el;
      this.applyActiveHighlight(el);
      this.previewElement = el;
      this.renderActiveOverlay();
      this.sendElementDataToSidebar(el, 'hover');
    };

    this.mouseLeaveHandler = (e) => {
      const el = e.target;
      if (el === this.hoveredElement) {
        this.clearHoverHighlight();
        this.previewElement = null;
        this.renderActiveOverlay();
        this.notifyHoverCleared();
      }
    };

    document.addEventListener('mouseover', this.mouseEnterHandler, true);
    document.addEventListener('mouseout', this.mouseLeaveHandler, true);
  }

  clearHoverHighlight() {
    if (!this.hoveredElement) return;
    const el = this.hoveredElement;
    if (el !== this.selectedElement) {
      this.restoreElementOutline(el);
      const originalBackgroundColor = this.originalBackgroundColors.get(el);
      el.style.removeProperty('background-color');
      if (originalBackgroundColor && originalBackgroundColor !== '') {
        el.style.backgroundColor = originalBackgroundColor;
      }
      this.originalBackgroundColors.delete(el);
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
    this.previewElement = null;
    this.notifyHoverCleared();
  }

  removeClickHandler() {
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler, true);
      this.clickHandler = null;
    }
  }

  deselectElement() {
    const previous = this.selectedElement;
    if (!previous) return;

    this.selectedElement = null;
    this.selectionRef = null;

    this.restoreElementOutline(previous);
    const origBg = this.originalBackgroundColors.get(previous);
    previous.style.removeProperty('background-color');
    if (origBg && origBg !== '') {
      previous.style.backgroundColor = origBg;
    }
    this.originalBackgroundColors.delete(previous);
    this.updateElementLabel(previous);
    this.clearBoxModelOverlay();
    chrome.runtime.sendMessage({ action: 'elementDeselected' }).catch(() => {});
  }

  selectElement(element) {
    if (!element || !this.shouldInspectElement(element)) return;

    // Double-click same element = deselect
    if (element === this.selectedElement) {
      this.deselectElement();
      return;
    }

    const previous = this.selectedElement;
    this.selectedElement = element;
    this.selectionRef = this.createSelectionRef(element);
    this.previewElement = null;

    // Send element data to sidebar
    this.sendElementDataToSidebar(element, 'selected');

    // Highlight selected element
    this.highlightSelectedElement(element, previous);
    if (previous && previous !== element) {
      this.updateElementLabel(previous);
    }
    this.updateElementLabel(element);
    this.renderActiveOverlay();
    this.notifyHoverCleared();
  }

  highlightSelectedElement(element, previousElement = this.selectedElement) {
    // Remove previous highlight
    const previous = previousElement;
    if (previous && previous !== element) {
      this.restoreElementOutline(previous);
      const originalBackgroundColor = this.originalBackgroundColors.get(previous);
      previous.style.removeProperty('background-color');
      if (originalBackgroundColor && originalBackgroundColor !== '') {
        previous.style.backgroundColor = originalBackgroundColor;
      }
      this.originalBackgroundColors.delete(previous);
    }

    // Add highlight to selected element
    if (element) {
      this.applyActiveHighlight(element);
    }
  }

  applyActiveHighlight(element) {
    if (!element) return;

    if (!this.originalBackgroundColors.has(element)) {
      this.originalBackgroundColors.set(element, element.style.backgroundColor || '');
    }

    element.style.setProperty('outline', '1px solid #ff4fa3', 'important');
    element.style.setProperty('outline-offset', '0px', 'important');
    element.style.setProperty('background-color', 'rgba(255, 79, 163, 0.05)', 'important');
  }

  getParentContext(element) {
    const parent = element.parentElement;
    if (!parent || parent === document.body || parent === document.documentElement) {
      return null;
    }

    const styles = window.getComputedStyle(parent);
    const classes = this.getElementClasses(parent);
    const label = `${parent.tagName.toLowerCase()}${parent.id ? `#${parent.id}` : ''}${classes.length ? ` ${classes.slice(0, 3).join(' ')}` : ''}`;

    return {
      label,
      display: styles.display,
      flexDirection: styles.flexDirection,
      justifyContent: styles.justifyContent,
      alignItems: styles.alignItems,
      justifyItems: styles.justifyItems,
      gridFlow: styles.gridAutoFlow,
      gap: styles.gap
    };
  }

  getNavigationTarget(element, direction) {
    if (!element) return null;

    if (direction === 'parent') {
      let parent = element.parentElement;
      while (parent && !this.shouldInspectElement(parent)) {
        parent = parent.parentElement;
      }
      return parent;
    }

    if (direction === 'child') {
      const children = Array.from(element.children || []);
      return children.find((child) => this.shouldInspectElement(child)) || null;
    }

    if (direction === 'previous' || direction === 'next') {
      let sibling = direction === 'previous' ? element.previousElementSibling : element.nextElementSibling;
      while (sibling && !this.shouldInspectElement(sibling)) {
        sibling = direction === 'previous' ? sibling.previousElementSibling : sibling.nextElementSibling;
      }
      return sibling;
    }

    return null;
  }

  getNavigationState(element) {
    return {
      parent: !!this.getNavigationTarget(element, 'parent'),
      child: !!this.getNavigationTarget(element, 'child'),
      previous: !!this.getNavigationTarget(element, 'previous'),
      next: !!this.getNavigationTarget(element, 'next')
    };
  }

  navigateSelection(direction) {
    const target = this.getNavigationTarget(this.selectedElement, direction);
    if (!target) return null;
    this.selectElement(target);
    return target;
  }

  createSelectionRef(element) {
    return {
      selector: this.getSelector(element),
      path: this.getElementPath(element)
    };
  }

  getElementPath(element) {
    const path = [];
    let current = element;
    while (current && current.parentElement && current !== document.body) {
      const parent = current.parentElement;
      path.unshift(Array.prototype.indexOf.call(parent.children, current));
      current = parent;
    }
    return path;
  }

  resolveElementPath(path = []) {
    let current = document.body;
    for (const index of path) {
      if (!current || !current.children || !current.children[index]) {
        return null;
      }
      current = current.children[index];
    }
    return current;
  }

  restoreSelectedElement() {
    if (!this.selectionRef) return null;

    const byPath = this.resolveElementPath(this.selectionRef.path);
    if (byPath && this.shouldInspectElement(byPath)) {
      return byPath;
    }

    const selector = this.selectionRef.selector;
    if (selector) {
      try {
        const bySelector = document.querySelector(selector);
        if (bySelector && this.shouldInspectElement(bySelector)) {
          return bySelector;
        }
      } catch (error) {
        return null;
      }
    }

    return null;
  }

  syncTrackedState() {
    if (this.selectedElement && !document.contains(this.selectedElement)) {
      const restored = this.restoreSelectedElement();
      if (restored) {
        this.selectedElement = restored;
        this.sendElementDataToSidebar(restored, 'selected');
      } else {
        this.selectedElement = null;
        this.selectionRef = null;
      }
    }

    if (this.previewElement && !document.contains(this.previewElement)) {
      this.previewElement = null;
      this.notifyHoverCleared();
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

  formatPxValue(value) {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? `${rounded}` : `${rounded}`;
  }

  getTailwindSpacingValue(value) {
    const rounded = Math.round(value * 100) / 100;
    for (const [px, token] of this.tailwindSpacingScale.entries()) {
      if (Math.abs(px - rounded) < 0.1) {
        return token;
      }
    }
    return `[${this.formatPxValue(rounded)}px]`;
  }

  getSpacingClasses(prefix, top, right, bottom, left) {
    const token = (value) => this.getTailwindSpacingValue(value);

    if (top === right && top === bottom && top === left) {
      return [`${prefix}-${token(top)}`];
    }

    if (left === right && top === bottom) {
      return [
        `${prefix}x-${token(left)}`,
        `${prefix}y-${token(top)}`
      ];
    }

    const parts = [];
    if (top !== 0) parts.push(`${prefix}t-${token(top)}`);
    if (right !== 0) parts.push(`${prefix}r-${token(right)}`);
    if (bottom !== 0) parts.push(`${prefix}b-${token(bottom)}`);
    if (left !== 0) parts.push(`${prefix}l-${token(left)}`);

    return parts.length > 0 ? parts : [`${prefix}-0`];
  }

  getPaddingClasses(element) {
    const styles = window.getComputedStyle(element);
    return this.getSpacingClasses(
      'p',
      parseFloat(styles.paddingTop) || 0,
      parseFloat(styles.paddingRight) || 0,
      parseFloat(styles.paddingBottom) || 0,
      parseFloat(styles.paddingLeft) || 0
    );
  }

  getMarginClasses(element) {
    const styles = window.getComputedStyle(element);
    return this.getSpacingClasses(
      'm',
      parseFloat(styles.marginTop) || 0,
      parseFloat(styles.marginRight) || 0,
      parseFloat(styles.marginBottom) || 0,
      parseFloat(styles.marginLeft) || 0
    );
  }

  getLabelText(element) {
    const parts = [];

    if (this.labelSettings.showElement) {
      const tag = element.tagName.toLowerCase();
      const classes = this.getElementClasses(element);
      const classStr = classes.length > 0 ? `.${classes.slice(0, 2).join('.')}` : '';
      parts.push(`${tag}${classStr}`);
    }

    if (this.labelSettings.showPadding) {
      parts.push(this.getPaddingClasses(element).join(' '));
    }

    if (this.labelSettings.showMargin) {
      parts.push(this.getMarginClasses(element).join(' '));
    }

    return parts.join('  ').trim();
  }

  positionLabel(label, rect, scrollX, scrollY) {
    label.style.left = `${Math.max(scrollX, rect.left + scrollX + 2)}px`;
    label.style.top = `${rect.top + scrollY - 8}px`;

    if (rect.top + scrollY < 8) {
      label.style.top = `${rect.top + scrollY + 2}px`;
    }
  }

  getBorderColor(opacity = this.borderOpacity * 0.65) {
    return `rgba(255, 79, 163, ${Math.max(0.05, Math.min(1, opacity))})`;
  }

  applyBorderStyle(element) {
    const style = this.lineStyle === 'dotted' ? 'dotted' : 'solid';
    element.style.setProperty('outline', `1px ${style} ${this.getBorderColor()}`, 'important');
  }

  restoreElementOutline(element) {
    if (!element) return;

    if (this.showBorders && this.trackedElements.has(element)) {
      this.applyBorderStyle(element);
    } else {
      element.style.removeProperty('outline');
    }

    element.style.removeProperty('outline-offset');

    const originalOutline = this.originalOutlines.get(element);
    if ((!this.showBorders || !this.trackedElements.has(element)) && originalOutline && originalOutline !== '') {
      element.style.outline = originalOutline;
    }
  }

  shouldInspectElement(element) {
    const skipTags = ['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'HEAD', 'NOSCRIPT', 'SVG', 'PATH', 'G', 'CIRCLE', 'RECT'];
    const skipClasses = ['layout-debugger-label'];

    if (skipTags.includes(element.tagName)) return false;
    if (skipClasses.some(cls => element.classList.contains(cls))) return false;
    if (element === document.body || element === document.documentElement) return false;
    if (element.id === 'layout-debugger-styles' || element.id === 'layout-debugger-sidebar' || element.id === 'layout-debugger-box-model' || element.id === 'layout-debugger-monochrome') return false;
    if (element.closest && (element.closest('#layout-debugger-box-model') || element.closest('#layout-debugger-monochrome'))) return false;

    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);

    if (styles.display === 'none' || styles.visibility === 'hidden' || styles.opacity === '0') return false;
    if (rect.width === 0 && rect.height === 0) return false;

    return true;
  }

  updateElementLabel(element) {
    let label = this.labelElements.get(element);
    const labelText = this.getLabelText(element);

    if (!labelText || element !== this.selectedElement) {
      if (label) {
        label.remove();
        this.labelElements.delete(element);
      }
      return;
    }

    if (!label) {
      label = this.createLabel(element);
      if (!label) return;
      this.labelElements.set(element, label);
    }

    const rect = element.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    label.textContent = labelText;
    label.style.display = 'block';
    this.positionLabel(label, rect, scrollX, scrollY);
  }

  removeElementOverlay(element) {
    const label = this.labelElements.get(element);
    if (label) {
      label.remove();
      this.labelElements.delete(element);
    }

    element.style.removeProperty('outline');
    element.style.removeProperty('outline-offset');

    const originalOutline = this.originalOutlines.get(element);
    if (originalOutline && originalOutline !== '') {
      element.style.outline = originalOutline;
    }
    const originalBackgroundColor = this.originalBackgroundColors.get(element);
    element.style.removeProperty('background-color');
    if (originalBackgroundColor && originalBackgroundColor !== '') {
      element.style.backgroundColor = originalBackgroundColor;
    }
    this.originalOutlines.delete(element);
    this.originalBackgroundColors.delete(element);
    this.trackedElements.delete(element);
    if (this.selectedElement === element) {
      this.selectedElement = null;
    }
    if (this.hoveredElement === element) {
      this.hoveredElement = null;
    }
    if (this.previewElement === element) {
      this.previewElement = null;
    }
  }

  parsePx(value) {
    const num = parseFloat(value);
    return Number.isNaN(num) ? 0 : num;
  }

  setOverlayRect(part, left, top, width, height) {
    if (!part) return;
    if (width <= 0 || height <= 0) {
      part.style.display = 'none';
      return;
    }

    part.style.display = 'block';
    part.style.left = `${left}px`;
    part.style.top = `${top}px`;
    part.style.width = `${width}px`;
    part.style.height = `${height}px`;
  }

  clearBoxModelOverlay() {
    if (!this.boxModelOverlay) return;
    this.boxModelOverlay.layer.style.display = 'block';
    ['margin', 'border', 'padding', 'content'].forEach((key) => {
      this.boxModelOverlay[key].style.display = 'none';
    });
  }

  updateMonochromeOverlay() {
    if (!this.monochromeOverlay) return;
    this.monochromeOverlay.style.display = this.monochromeEnabled ? 'block' : 'none';
  }

  getActiveOverlayElement() {
    if (this.hoverInspectEnabled && this.previewElement) {
      return this.previewElement;
    }
    return this.selectedElement;
  }

  renderBoxModelOverlay(element, mode = 'selected') {
    if (!this.boxModelOverlay || !element || !document.contains(element)) {
      this.clearBoxModelOverlay();
      return;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      this.clearBoxModelOverlay();
      return;
    }

    const styles = window.getComputedStyle(element);
    const marginTop = this.parsePx(styles.marginTop);
    const marginRight = this.parsePx(styles.marginRight);
    const marginBottom = this.parsePx(styles.marginBottom);
    const marginLeft = this.parsePx(styles.marginLeft);
    const borderTop = this.parsePx(styles.borderTopWidth);
    const borderRight = this.parsePx(styles.borderRightWidth);
    const borderBottom = this.parsePx(styles.borderBottomWidth);
    const borderLeft = this.parsePx(styles.borderLeftWidth);
    const paddingTop = this.parsePx(styles.paddingTop);
    const paddingRight = this.parsePx(styles.paddingRight);
    const paddingBottom = this.parsePx(styles.paddingBottom);
    const paddingLeft = this.parsePx(styles.paddingLeft);

    const overlay = this.boxModelOverlay;
    overlay.layer.style.display = 'block';
    const alpha = mode === 'hover' ? 0.1 : 0.18;
    overlay.margin.style.background = `rgba(245, 158, 11, ${alpha})`;
    overlay.border.style.background = `rgba(239, 68, 68, ${mode === 'hover' ? 0.05 : 0.08})`;
    overlay.padding.style.background = `rgba(59, 130, 246, ${mode === 'hover' ? 0.08 : 0.12})`;
    overlay.content.style.background = `rgba(16, 185, 129, ${mode === 'hover' ? 0.1 : 0.14})`;

    this.setOverlayRect(
      overlay.margin,
      rect.left - marginLeft,
      rect.top - marginTop,
      rect.width + marginLeft + marginRight,
      rect.height + marginTop + marginBottom
    );
    this.setOverlayRect(overlay.border, rect.left, rect.top, rect.width, rect.height);
    this.setOverlayRect(
      overlay.padding,
      rect.left + borderLeft,
      rect.top + borderTop,
      rect.width - borderLeft - borderRight,
      rect.height - borderTop - borderBottom
    );
    this.setOverlayRect(
      overlay.content,
      rect.left + borderLeft + paddingLeft,
      rect.top + borderTop + paddingTop,
      rect.width - borderLeft - borderRight - paddingLeft - paddingRight,
      rect.height - borderTop - borderBottom - paddingTop - paddingBottom
    );
  }

  renderActiveOverlay() {
    const activeElement = this.getActiveOverlayElement();
    const mode = this.hoverInspectEnabled && this.previewElement ? 'hover' : 'selected';
    this.renderBoxModelOverlay(activeElement, mode);
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

    const color = this.getElementColor(element);

    label.textContent = this.getLabelText(element);
    label.style.cssText = `
      position: absolute;
      background: ${color};
      color: white;
      padding: 1px 4px;
      font-size: 9px;
      font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
      font-weight: bold;
      white-space: nowrap;
      pointer-events: none;
      z-index: 999998;
      border-radius: 2px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      line-height: 1.1;
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
      border: 1px solid rgba(255,255,255,0.35);
    `;

    this.positionLabel(label, rect, scrollX, scrollY);

    document.body.appendChild(label);
    return label;
  }

  // Add borders and labels to all elements
  addBordersToElements() {
    if (!this.showBorders) return;
    this.syncTrackedState();
    const allElements = Array.from(document.querySelectorAll('*'));
    const elementsToStyle = allElements.filter((element) => this.shouldInspectElement(element));
    const nextElements = new Set(elementsToStyle);

    Array.from(this.trackedElements).forEach((element) => {
      if (!nextElements.has(element)) {
        this.removeElementOverlay(element);
      }
    });

    elementsToStyle.forEach((element) => {
      this.trackedElements.add(element);

      if (!this.originalOutlines.has(element)) {
        const originalOutline = element.style.outline || '';
        this.originalOutlines.set(element, originalOutline);
      }

      if (element !== this.selectedElement && element !== this.hoveredElement) {
        this.applyBorderStyle(element);
      }

      if (element === this.selectedElement) {
        this.updateElementLabel(element);
      } else if (this.labelElements.has(element)) {
        this.updateElementLabel(element);
      }
    });

    this.borderStyleSheet.textContent = '';
    this.renderActiveOverlay();
  }

  // Remove all borders (outlines)
  removeAllBorders() {
    Array.from(this.trackedElements).forEach(element => {
      this.removeElementOverlay(element);
    });

    // Clear the stylesheet content
    if (this.borderStyleSheet) {
      this.borderStyleSheet.textContent = '';
    }

    // Also remove selected element highlight
    const selected = this.selectedElement;
    if (selected) {
      this.removeElementOverlay(selected);
    }
    this.clearBoxModelOverlay();
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
    if (!this.showBorders) {
      this.syncTrackedState();
      this.renderActiveOverlay();
      return;
    }

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

      const labelText = this.getLabelText(element);
      if (!labelText) {
        label.style.display = 'none';
        return;
      }

      label.style.display = 'block';
      label.textContent = labelText;
      this.positionLabel(label, rect, scrollX, scrollY);
    });

    this.renderActiveOverlay();
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
      const hasActiveOverlay = Boolean(this.selectedElement || this.previewElement);

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
      } else if (hasActiveOverlay) {
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(() => {
          this.syncTrackedState();
          this.renderActiveOverlay();
        }, 50);
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

  setBorderOpacity(opacity) {
    const nextOpacity = Number(opacity);
    if (Number.isNaN(nextOpacity)) return;
    this.borderOpacity = Math.max(0.05, Math.min(1, nextOpacity));
    if (this.showBorders) {
      this.addBordersToElements();
    }
  }

  setLabelSettings(settings = {}) {
    this.labelSettings = {
      showElement: Boolean(settings.showElement ?? this.defaultLabelSettings.showElement),
      showPadding: Boolean(settings.showPadding ?? this.defaultLabelSettings.showPadding),
      showMargin: Boolean(settings.showMargin ?? this.defaultLabelSettings.showMargin)
    };

    if (this.showBorders) {
      this.addBordersToElements();
    }
  }

  setHoverInspect(enabled) {
    this.hoverInspectEnabled = Boolean(enabled);
    if (!this.hoverInspectEnabled) {
      this.clearHoverHighlight();
      this.previewElement = null;
      this.notifyHoverCleared();
      this.deselectElement();
    }
    this.renderActiveOverlay();
  }

  setMonochromeMode(enabled) {
    this.monochromeEnabled = Boolean(enabled);
    this.updateMonochromeOverlay();
  }

  // Activate border mode
  activateBorders(lineStyle) {
    if (this.showBorders) return; // Already active
    if (lineStyle === 'dotted' || lineStyle === 'solid') {
      this.lineStyle = lineStyle;
    }
    this.showBorders = true;
    this.addBordersToElements();
  }

  // Deactivate border mode
  deactivateBorders() {
    if (!this.showBorders) return; // Already inactive

    // Save inspection state before removal clears it
    const selected = this.selectedElement;
    const hovered = this.hoveredElement;
    const preview = this.previewElement;
    const selRef = this.selectionRef;

    this.showBorders = false;
    this.borderStyleSheet.textContent = '';
    this.removeAllLabels();
    this.removeAllBorders();

    if (this.hoverInspectEnabled) {
      // Restore inspection state — borders are off but inspect is still active
      this.selectedElement = selected;
      this.hoveredElement = hovered;
      this.previewElement = preview;
      this.selectionRef = selRef;

      if (selected) this.applyActiveHighlight(selected);
      if (hovered && hovered !== selected) this.applyActiveHighlight(hovered);
      this.renderActiveOverlay();
    } else {
      this.hoveredElement = null;
      this.previewElement = null;
      this.selectedElement = null;
      this.selectionRef = null;
      this.clearBoxModelOverlay();
      this.notifyHoverCleared();
    }
  }

  // Full cleanup — remove all injected DOM, listeners, and state
  destroy() {
    // Deactivate features
    if (this.showBorders) {
      this.showBorders = false;
      this.borderStyleSheet.textContent = '';
      this.removeAllLabels();
      this.removeAllBorders();
    }

    // Clear active element styles
    [this.selectedElement, this.hoveredElement, this.previewElement].filter(Boolean).forEach(el => {
      el.style.removeProperty('outline');
      el.style.removeProperty('outline-offset');
      el.style.removeProperty('background-color');
      const origBg = this.originalBackgroundColors.get(el);
      if (origBg && origBg !== '') el.style.backgroundColor = origBg;
      const origOutline = this.originalOutlines.get(el);
      if (origOutline && origOutline !== '') el.style.outline = origOutline;
    });

    this.selectedElement = null;
    this.selectionRef = null;
    this.hoveredElement = null;
    this.previewElement = null;
    this.hoverInspectEnabled = false;
    this.monochromeEnabled = false;

    // Remove event listeners
    this.removeClickHandler();
    this.removeHoverHighlight();
    this.cleanupObservers();

    // Remove injected DOM elements
    if (this.borderStyleSheet?.parentNode) {
      this.borderStyleSheet.parentNode.removeChild(this.borderStyleSheet);
      this.borderStyleSheet = null;
    }
    if (this.boxModelOverlay?.layer?.parentNode) {
      this.boxModelOverlay.layer.parentNode.removeChild(this.boxModelOverlay.layer);
      this.boxModelOverlay = null;
    }
    if (this.monochromeOverlay?.parentNode) {
      this.monochromeOverlay.parentNode.removeChild(this.monochromeOverlay);
      this.monochromeOverlay = null;
    }

    // Remove any orphaned labels
    document.querySelectorAll('.layout-debugger-label').forEach(el => el.remove());

    this.trackedElements.clear();
    this.labelElements.clear();
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
      if (request.borderOpacity !== undefined) {
        debuggerInstance.setBorderOpacity(request.borderOpacity);
      }
      if (request.labelSettings) {
        debuggerInstance.setLabelSettings(request.labelSettings);
      }
      const bordersActive = debuggerInstance.toggleBorders(lineStyle);
      sendResponse({
        success: true,
        active: bordersActive,
        lineStyle: debuggerInstance.lineStyle,
        borderOpacity: debuggerInstance.borderOpacity,
        labelSettings: debuggerInstance.labelSettings
      });
      break;

    case 'setLineStyle':
      debuggerInstance.setLineStyle(request.lineStyle);
      sendResponse({ success: true, lineStyle: debuggerInstance.lineStyle });
      break;

    case 'setBorderOpacity':
      debuggerInstance.setBorderOpacity(request.borderOpacity);
      sendResponse({ success: true, borderOpacity: debuggerInstance.borderOpacity });
      break;

    case 'setLabelSettings':
      debuggerInstance.setLabelSettings(request.labelSettings);
      sendResponse({ success: true, labelSettings: debuggerInstance.labelSettings });
      break;

    case 'setHoverInspect':
      debuggerInstance.setHoverInspect(request.hoverInspectEnabled);
      sendResponse({ success: true, hoverInspectEnabled: debuggerInstance.hoverInspectEnabled });
      break;

    case 'setMonochromeMode':
      debuggerInstance.setMonochromeMode(request.monochromeEnabled);
      sendResponse({ success: true, monochromeEnabled: debuggerInstance.monochromeEnabled });
      break;

    case 'navigateSelection': {
      const target = debuggerInstance.navigateSelection(request.direction);
      if (!target) {
        sendResponse({ success: false, error: 'No navigation target' });
        break;
      }
      sendResponse({ success: true });
      break;
    }

    case 'deactivateAll':
      debuggerInstance.destroy();
      debuggerInstance = null;
      sendResponse({ success: true });
      break;

    case 'getState':
      sendResponse({
        showBorders: debuggerInstance.showBorders,
        lineStyle: debuggerInstance.lineStyle,
        borderOpacity: debuggerInstance.borderOpacity,
        labelSettings: debuggerInstance.labelSettings,
        hoverInspectEnabled: debuggerInstance.hoverInspectEnabled,
        monochromeEnabled: debuggerInstance.monochromeEnabled
      });
      break;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }

  return true; // Keep the message channel open for async response
});
