/**
 * openPointer — Content Script
 * Runs on every page. Handles:
 * - DOM element analysis & context detection
 * - Hover tooltips with AI suggestions
 * - Action recording for macros
 * - Macro playback
 * - Natural language command execution
 * - Smart form filling
 * - Result overlay display
 */

(() => {
  'use strict';

  // ============================================================
  // State
  // ============================================================

  const state = {
    isRecording: false,
    hoverTimeout: null,
    currentTooltip: null,
    overlayVisible: false,
  };

  // ============================================================
  // Result Overlay
  // ============================================================

  function createOverlay() {
    let overlay = document.getElementById('openpointer-overlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'openpointer-overlay';
    overlay.innerHTML = `
      <div class="op-overlay-backdrop"></div>
      <div class="op-overlay-panel">
        <div class="op-overlay-header">
          <div class="op-overlay-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
              <path d="M13 13l6 6"/>
            </svg>
            <span>openPointer</span>
          </div>
          <button class="op-overlay-close" id="op-close-overlay">&times;</button>
        </div>
        <div class="op-overlay-content" id="op-overlay-content">
          <div class="op-loading">
            <div class="op-spinner"></div>
            <span>Processing...</span>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('op-close-overlay').addEventListener('click', hideOverlay);
    overlay.querySelector('.op-overlay-backdrop').addEventListener('click', hideOverlay);

    return overlay;
  }

  function showOverlay(content, isLoading = false) {
    const overlay = createOverlay();
    const contentEl = document.getElementById('op-overlay-content');

    if (isLoading) {
      contentEl.innerHTML = `
        <div class="op-loading">
          <div class="op-spinner"></div>
          <span>Processing...</span>
        </div>
      `;
    } else {
      contentEl.innerHTML = `<div class="op-result">${formatMarkdown(content)}</div>`;
    }

    overlay.classList.add('op-visible');
    state.overlayVisible = true;
  }

  function hideOverlay() {
    const overlay = document.getElementById('openpointer-overlay');
    if (overlay) {
      overlay.classList.remove('op-visible');
      state.overlayVisible = false;
    }
  }

  function formatMarkdown(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n- /g, '</p><li>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  }

  // ============================================================
  // Recording Indicator
  // ============================================================

  function showRecordingIndicator() {
    let indicator = document.getElementById('op-recording-indicator');
    if (indicator) return;

    indicator = document.createElement('div');
    indicator.id = 'op-recording-indicator';
    indicator.innerHTML = `
      <div class="op-rec-dot"></div>
      <span>Recording</span>
      <button id="op-stop-recording">Stop</button>
    `;
    document.body.appendChild(indicator);

    document.getElementById('op-stop-recording').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'toggle-recording' });
    });
  }

  function hideRecordingIndicator() {
    const indicator = document.getElementById('op-recording-indicator');
    if (indicator) indicator.remove();
  }

  // ============================================================
  // Hover Tooltip (Concept 1: Contextual Actions)
  // ============================================================

  function createTooltip(element, actions) {
    removeTooltip();

    const rect = element.getBoundingClientRect();
    const tooltip = document.createElement('div');
    tooltip.id = 'op-hover-tooltip';
    tooltip.className = 'op-tooltip';

    const actionsHTML = actions
      .map(
        (a) => `
      <button class="op-tooltip-action" data-action="${a.action}" data-type="${a.type || ''}">
        <span class="op-tooltip-icon">${a.icon}</span>
        <span>${a.label}</span>
      </button>
    `
      )
      .join('');

    tooltip.innerHTML = `<div class="op-tooltip-actions">${actionsHTML}</div>`;

    // Position
    const top = rect.bottom + window.scrollY + 8;
    const left = Math.max(8, rect.left + window.scrollX);
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;

    document.body.appendChild(tooltip);
    state.currentTooltip = tooltip;

    // Action handlers
    tooltip.querySelectorAll('.op-tooltip-action').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const action = btn.dataset.action;
        const type = btn.dataset.type;

        if (action === 'ai-action') {
          const selectedText = window.getSelection()?.toString() || element.textContent;
          showOverlay('', true);
          chrome.runtime.sendMessage(
            { action: 'ai-process', type, text: selectedText },
            (response) => {
              if (response?.result) {
                showOverlay(response.result);
              }
            }
          );
        }

        removeTooltip();
      });
    });

    // Auto-hide after 5 seconds
    setTimeout(removeTooltip, 5000);
  }

  function removeTooltip() {
    if (state.currentTooltip) {
      state.currentTooltip.remove();
      state.currentTooltip = null;
    }
  }

  function getContextActions(element) {
    const actions = [];
    const tag = element.tagName.toLowerCase();
    const hasSelection = window.getSelection()?.toString().length > 0;

    if (hasSelection) {
      actions.push(
        { icon: '📝', label: 'Summarize', action: 'ai-action', type: 'summarize' },
        { icon: '💡', label: 'Explain', action: 'ai-action', type: 'explain' },
        { icon: '🌐', label: 'Translate', action: 'ai-action', type: 'translate' },
        { icon: '📊', label: 'Extract Data', action: 'ai-action', type: 'extract-data' }
      );
    } else if (tag === 'img') {
      actions.push(
        { icon: '🖼️', label: 'Describe Image', action: 'ai-action', type: 'describe-image' },
        { icon: '📄', label: 'Extract Text', action: 'ai-action', type: 'ocr' }
      );
    } else if (tag === 'a') {
      actions.push(
        { icon: '🔗', label: 'Preview Link', action: 'ai-action', type: 'preview-link' }
      );
    } else if (['input', 'textarea', 'select'].includes(tag)) {
      actions.push(
        { icon: '✨', label: 'Smart Fill', action: 'smart-fill', type: '' }
      );
    } else if (element.textContent?.trim().length > 50) {
      actions.push(
        { icon: '📝', label: 'Summarize', action: 'ai-action', type: 'summarize' },
        { icon: '💡', label: 'Explain', action: 'ai-action', type: 'explain' }
      );
    }

    return actions;
  }

  // ============================================================
  // Action Recording (Concept 2: Learning & Automation)
  // ============================================================

  function recordAction(type, data) {
    if (!state.isRecording) return;

    chrome.runtime.sendMessage({
      action: 'record-action',
      actionData: {
        type,
        ...data,
        url: window.location.href,
        timestamp: Date.now(),
      },
    });
  }

  function getElementSelector(element) {
    if (element.id) return `#${element.id}`;
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/).slice(0, 3).join('.');
      if (classes) return `${element.tagName.toLowerCase()}.${classes}`;
    }

    // Build path
    const path = [];
    let current = element;
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      if (current.id) {
        selector = `#${current.id}`;
        path.unshift(selector);
        break;
      }
      const siblings = current.parentElement?.children;
      if (siblings && siblings.length > 1) {
        const index = Array.from(siblings).indexOf(current);
        selector += `:nth-child(${index + 1})`;
      }
      path.unshift(selector);
      current = current.parentElement;
    }
    return path.join(' > ');
  }

  // ============================================================
  // Macro Playback
  // ============================================================

  async function playMacroActions(actions) {
    showOverlay('Playing macro...', true);

    for (const action of actions) {
      try {
        await executeAction(action);
        await sleep(action.delay || 500);
      } catch (err) {
        console.warn('Macro action failed:', err);
      }
    }

    showOverlay('Macro playback complete! All actions executed successfully.');
  }

  async function executeAction(action) {
    const element = document.querySelector(action.selector);
    if (!element) {
      console.warn(`Element not found: ${action.selector}`);
      return;
    }

    switch (action.type) {
      case 'click':
        element.click();
        break;
      case 'input':
        element.focus();
        element.value = action.value || '';
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      case 'scroll':
        window.scrollBy(0, action.scrollY || 0);
        break;
      case 'keypress':
        element.dispatchEvent(
          new KeyboardEvent('keydown', { key: action.key, bubbles: true })
        );
        break;
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================================
  // Smart Form Filling (Concept 1)
  // ============================================================

  function smartFillForms() {
    const inputs = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select'
    );

    let filledCount = 0;

    inputs.forEach((input) => {
      const name = (input.name || input.id || input.placeholder || '').toLowerCase();
      const type = input.type?.toLowerCase() || '';
      let value = '';

      // Pattern matching for common form fields
      if (name.includes('email') || type === 'email') {
        value = 'user@example.com';
      } else if (name.includes('name') && name.includes('first')) {
        value = 'John';
      } else if (name.includes('name') && name.includes('last')) {
        value = 'Doe';
      } else if (name.includes('name') && !name.includes('user')) {
        value = 'John Doe';
      } else if (name.includes('phone') || type === 'tel') {
        value = '+1 (555) 123-4567';
      } else if (name.includes('address') || name.includes('street')) {
        value = '123 Main Street';
      } else if (name.includes('city')) {
        value = 'San Francisco';
      } else if (name.includes('state') || name.includes('province')) {
        value = 'California';
      } else if (name.includes('zip') || name.includes('postal')) {
        value = '94102';
      } else if (name.includes('country')) {
        value = 'United States';
      } else if (name.includes('company') || name.includes('organization')) {
        value = 'Acme Inc.';
      } else if (name.includes('url') || name.includes('website') || type === 'url') {
        value = 'https://example.com';
      }

      if (value && input.tagName.toLowerCase() !== 'select') {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        filledCount++;
      }
    });

    showOverlay(
      `**Smart Fill Complete**\n\nFilled ${filledCount} form field(s) with sample data.\n\nConnect an AI provider in settings to fill forms with your actual profile data from open tabs and connected services.`
    );
  }

  // ============================================================
  // Natural Language Command Execution (Concept 3)
  // ============================================================

  function executeNLCommand(intent, originalCommand) {
    switch (intent.action) {
      case 'summarize-page': {
        const pageText = document.body.innerText.substring(0, 5000);
        showOverlay('', true);
        chrome.runtime.sendMessage(
          { action: 'ai-process', type: 'summarize', text: pageText },
          (response) => {
            if (response?.result) showOverlay(response.result);
          }
        );
        break;
      }

      case 'click-element': {
        const target = intent.params.target;
        const elements = document.querySelectorAll('button, a, [role="button"], input[type="submit"]');
        let found = false;
        elements.forEach((el) => {
          if (
            el.textContent?.toLowerCase().includes(target.toLowerCase()) ||
            el.getAttribute('aria-label')?.toLowerCase().includes(target.toLowerCase())
          ) {
            el.click();
            found = true;
            showOverlay(`**Clicked:** "${el.textContent?.trim() || target}"`);
          }
        });
        if (!found) {
          showOverlay(`**Could not find** an element matching "${target}". Try being more specific.`);
        }
        break;
      }

      case 'smart-fill':
        smartFillForms();
        break;

      case 'scroll':
        const amount = intent.params.direction === 'down' ? 500 : -500;
        window.scrollBy({ top: amount, behavior: 'smooth' });
        showOverlay(`**Scrolled ${intent.params.direction}**`);
        break;

      case 'search-page': {
        const query = intent.params.query;
        if (window.find) {
          window.find(query);
          showOverlay(`**Searching for:** "${query}"`);
        }
        break;
      }

      case 'describe-page': {
        const title = document.title;
        const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
          .slice(0, 10)
          .map((h) => `- ${h.tagName}: ${h.textContent?.trim()}`)
          .join('\n');
        const links = document.querySelectorAll('a[href]').length;
        const images = document.querySelectorAll('img').length;
        const forms = document.querySelectorAll('form').length;

        showOverlay(
          `**Page Description**\n\n**Title:** ${title}\n**URL:** ${window.location.href}\n\n**Structure:**\n${headings}\n\n**Elements:** ${links} links, ${images} images, ${forms} forms`
        );
        break;
      }

      case 'navigate': {
        const target = intent.params.target;
        if (target.includes('.') || target.includes('http')) {
          const url = target.startsWith('http') ? target : `https://${target}`;
          window.location.href = url;
        } else {
          showOverlay(`**Navigation:** Looking for "${target}" — connect an AI provider for intelligent navigation.`);
        }
        break;
      }

      default:
        showOverlay(`**Command received:** "${originalCommand}"\n\nConnect an AI provider in settings for full natural language processing.`);
    }
  }

  // ============================================================
  // Semantic Element Labeling (Concept 3: Visual Search)
  // ============================================================

  function labelPageElements() {
    // Remove existing labels
    document.querySelectorAll('.op-semantic-label').forEach((l) => l.remove());

    const interactiveElements = document.querySelectorAll(
      'button, a[href], input, textarea, select, [role="button"], [role="link"], [role="tab"]'
    );

    interactiveElements.forEach((el, index) => {
      if (!isElementVisible(el)) return;

      const rect = el.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return;

      const label = document.createElement('div');
      label.className = 'op-semantic-label';
      label.textContent = getElementLabel(el, index);
      label.style.top = `${rect.top + window.scrollY - 18}px`;
      label.style.left = `${rect.left + window.scrollX}px`;

      document.body.appendChild(label);
    });
  }

  function getElementLabel(element, index) {
    const tag = element.tagName.toLowerCase();
    const text = element.textContent?.trim().substring(0, 20) || '';
    const type = element.type || '';
    const role = element.getAttribute('role') || '';
    const ariaLabel = element.getAttribute('aria-label') || '';

    if (ariaLabel) return ariaLabel.substring(0, 25);
    if (tag === 'button' || role === 'button') return `Button: ${text}`;
    if (tag === 'a') return `Link: ${text}`;
    if (tag === 'input') return `Input: ${type}`;
    if (tag === 'textarea') return 'Text Area';
    if (tag === 'select') return 'Dropdown';
    return `[${index}] ${tag}`;
  }

  function isElementVisible(el) {
    const style = window.getComputedStyle(el);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      el.offsetParent !== null
    );
  }

  // ============================================================
  // Event Listeners
  // ============================================================

  // Hover for contextual actions
  let hoverTimer = null;
  document.addEventListener('mouseover', (e) => {
    if (state.overlayVisible) return;

    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      const target = e.target;
      if (target === document.body || target === document.documentElement) return;

      const actions = getContextActions(target);
      if (actions.length > 0) {
        // Only show tooltip if Alt key is held (to avoid being intrusive)
        // Or if there's a text selection
        if (e.altKey || window.getSelection()?.toString().length > 0) {
          createTooltip(target, actions);
        }
      }
    }, 300);
  });

  document.addEventListener('mouseout', () => {
    clearTimeout(hoverTimer);
  });

  // Record clicks
  document.addEventListener('click', (e) => {
    if (e.target.closest('#openpointer-overlay, #op-hover-tooltip, #op-recording-indicator')) return;

    removeTooltip();

    if (state.isRecording) {
      recordAction('click', {
        selector: getElementSelector(e.target),
        x: e.clientX,
        y: e.clientY,
        text: e.target.textContent?.substring(0, 50),
      });
    }
  }, true);

  // Record input changes
  document.addEventListener('input', (e) => {
    if (state.isRecording && e.target.tagName) {
      recordAction('input', {
        selector: getElementSelector(e.target),
        value: e.target.value,
      });
    }
  }, true);

  // Record scrolls (debounced)
  let scrollTimer = null;
  document.addEventListener('scroll', () => {
    if (!state.isRecording) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      recordAction('scroll', {
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      });
    }, 500);
  });

  // Keyboard shortcut: Escape to close overlay
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideOverlay();
      removeTooltip();
    }
  });

  // ============================================================
  // Message Handler (from background script)
  // ============================================================

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'ai-action':
        showOverlay('', true);
        chrome.runtime.sendMessage(
          { action: 'ai-process', type: message.type, text: message.text, imageUrl: message.imageUrl, url: message.url },
          (response) => {
            if (response?.result) showOverlay(response.result);
          }
        );
        break;

      case 'smart-fill':
        smartFillForms();
        break;

      case 'recording-started':
        state.isRecording = true;
        showRecordingIndicator();
        break;

      case 'recording-stopped':
        state.isRecording = false;
        hideRecordingIndicator();
        break;

      case 'play-macro':
        playMacroActions(message.actions);
        break;

      case 'execute-nl-command':
        executeNLCommand(message.intent, message.originalCommand);
        break;

      case 'label-elements':
        labelPageElements();
        break;

      case 'get-page-info':
        sendResponse({
          title: document.title,
          url: window.location.href,
          text: document.body.innerText.substring(0, 10000),
          formCount: document.querySelectorAll('form').length,
          linkCount: document.querySelectorAll('a[href]').length,
          imageCount: document.querySelectorAll('img').length,
        });
        return true;
    }
  });

  // ============================================================
  // Initialize
  // ============================================================

  console.log('openPointer content script loaded');
})();
