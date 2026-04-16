/**
 * openPointer — Background Service Worker
 * Handles: context menus, message routing, macro storage, side panel control
 */

// ============================================================
// State Management
// ============================================================

const state = {
  isRecording: false,
  recordedActions: [],
  savedMacros: [],
  settings: {
    aiProvider: 'openai',
    apiKey: '',
    contextMenuEnabled: true,
    predictiveEnabled: true,
    accessibilityMode: false,
    theme: 'dark',
  },
};

// Load persisted state on startup
chrome.storage.local.get(['savedMacros', 'settings'], (result) => {
  if (result.savedMacros) state.savedMacros = result.savedMacros;
  if (result.settings) state.settings = { ...state.settings, ...result.settings };
  setupContextMenus();
});

// ============================================================
// Context Menu Setup (Concept 1: Proactive Workflow Assistant)
// ============================================================

function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    // Parent menu
    chrome.contextMenus.create({
      id: 'openpointer-root',
      title: 'openPointer',
      contexts: ['all'],
    });

    // Text actions
    chrome.contextMenus.create({
      id: 'op-summarize',
      parentId: 'openpointer-root',
      title: 'Summarize Selection',
      contexts: ['selection'],
    });

    chrome.contextMenus.create({
      id: 'op-explain',
      parentId: 'openpointer-root',
      title: 'Explain This',
      contexts: ['selection'],
    });

    chrome.contextMenus.create({
      id: 'op-translate',
      parentId: 'openpointer-root',
      title: 'Translate Selection',
      contexts: ['selection'],
    });

    chrome.contextMenus.create({
      id: 'op-extract-data',
      parentId: 'openpointer-root',
      title: 'Extract Data',
      contexts: ['selection'],
    });

    // Separator
    chrome.contextMenus.create({
      id: 'op-sep-1',
      parentId: 'openpointer-root',
      type: 'separator',
      contexts: ['all'],
    });

    // Page actions
    chrome.contextMenus.create({
      id: 'op-summarize-page',
      parentId: 'openpointer-root',
      title: 'Summarize This Page',
      contexts: ['page'],
    });

    chrome.contextMenus.create({
      id: 'op-extract-contacts',
      parentId: 'openpointer-root',
      title: 'Extract Contact Info',
      contexts: ['page'],
    });

    chrome.contextMenus.create({
      id: 'op-fill-forms',
      parentId: 'openpointer-root',
      title: 'Smart Fill Forms',
      contexts: ['page', 'editable'],
    });

    // Separator
    chrome.contextMenus.create({
      id: 'op-sep-2',
      parentId: 'openpointer-root',
      type: 'separator',
      contexts: ['all'],
    });

    // Image actions
    chrome.contextMenus.create({
      id: 'op-describe-image',
      parentId: 'openpointer-root',
      title: 'Describe This Image',
      contexts: ['image'],
    });

    chrome.contextMenus.create({
      id: 'op-extract-text-image',
      parentId: 'openpointer-root',
      title: 'Extract Text from Image',
      contexts: ['image'],
    });

    // Link actions
    chrome.contextMenus.create({
      id: 'op-preview-link',
      parentId: 'openpointer-root',
      title: 'Preview Link Content',
      contexts: ['link'],
    });

    // Automation
    chrome.contextMenus.create({
      id: 'op-sep-3',
      parentId: 'openpointer-root',
      type: 'separator',
      contexts: ['all'],
    });

    chrome.contextMenus.create({
      id: 'op-record-macro',
      parentId: 'openpointer-root',
      title: state.isRecording ? '⏹ Stop Recording' : '⏺ Start Recording Macro',
      contexts: ['all'],
    });

    chrome.contextMenus.create({
      id: 'op-open-sidepanel',
      parentId: 'openpointer-root',
      title: 'Open Side Panel',
      contexts: ['all'],
    });
  });
}

// ============================================================
// Context Menu Click Handler
// ============================================================

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const tabId = tab?.id;
  if (!tabId) return;

  switch (info.menuItemId) {
    case 'op-summarize':
      sendToContentScript(tabId, {
        action: 'ai-action',
        type: 'summarize',
        text: info.selectionText,
      });
      break;

    case 'op-explain':
      sendToContentScript(tabId, {
        action: 'ai-action',
        type: 'explain',
        text: info.selectionText,
      });
      break;

    case 'op-translate':
      sendToContentScript(tabId, {
        action: 'ai-action',
        type: 'translate',
        text: info.selectionText,
      });
      break;

    case 'op-extract-data':
      sendToContentScript(tabId, {
        action: 'ai-action',
        type: 'extract-data',
        text: info.selectionText,
      });
      break;

    case 'op-summarize-page':
      sendToContentScript(tabId, {
        action: 'ai-action',
        type: 'summarize-page',
      });
      break;

    case 'op-extract-contacts':
      sendToContentScript(tabId, {
        action: 'ai-action',
        type: 'extract-contacts',
      });
      break;

    case 'op-fill-forms':
      sendToContentScript(tabId, {
        action: 'smart-fill',
      });
      break;

    case 'op-describe-image':
      sendToContentScript(tabId, {
        action: 'ai-action',
        type: 'describe-image',
        imageUrl: info.srcUrl,
      });
      break;

    case 'op-extract-text-image':
      sendToContentScript(tabId, {
        action: 'ai-action',
        type: 'ocr',
        imageUrl: info.srcUrl,
      });
      break;

    case 'op-preview-link':
      sendToContentScript(tabId, {
        action: 'ai-action',
        type: 'preview-link',
        url: info.linkUrl,
      });
      break;

    case 'op-record-macro':
      toggleRecording(tabId);
      break;

    case 'op-open-sidepanel':
      chrome.sidePanel.open({ tabId });
      break;
  }
});

// ============================================================
// Message Router
// ============================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  switch (message.action) {
    // Settings
    case 'get-settings':
      return { success: true, settings: state.settings };

    case 'save-settings':
      state.settings = { ...state.settings, ...message.settings };
      await chrome.storage.local.set({ settings: state.settings });
      return { success: true };

    // Recording (Concept 2: Learning & Automation Engine)
    case 'toggle-recording':
      return toggleRecording(sender.tab?.id || message.tabId);

    case 'get-recording-state':
      return { isRecording: state.isRecording, actions: state.recordedActions };

    case 'record-action':
      if (state.isRecording) {
        state.recordedActions.push({
          ...message.actionData,
          timestamp: Date.now(),
        });
      }
      return { success: true };

    case 'save-macro':
      return saveMacro(message.name, message.description);

    case 'get-macros':
      return { success: true, macros: state.savedMacros };

    case 'play-macro':
      return playMacro(message.macroId, sender.tab?.id || message.tabId);

    case 'delete-macro':
      return deleteMacro(message.macroId);

    // AI Actions (forwarded to content script or processed here)
    case 'ai-process':
      return processAIRequest(message);

    // Accessibility (Concept 3)
    case 'nl-command':
      return processNLCommand(message.command, sender.tab?.id);

    case 'get-page-elements':
      return { success: true };

    // Side panel
    case 'open-sidepanel':
      if (sender.tab?.id) {
        chrome.sidePanel.open({ tabId: sender.tab.id });
      }
      return { success: true };

    default:
      return { success: false, error: 'Unknown action' };
  }
}

// ============================================================
// Macro Recording & Playback (Concept 2)
// ============================================================

function toggleRecording(tabId) {
  state.isRecording = !state.isRecording;

  if (state.isRecording) {
    state.recordedActions = [];
    if (tabId) {
      sendToContentScript(tabId, { action: 'recording-started' });
    }
  } else {
    if (tabId) {
      sendToContentScript(tabId, { action: 'recording-stopped' });
    }
  }

  // Update context menu label
  setupContextMenus();

  return {
    success: true,
    isRecording: state.isRecording,
    actionCount: state.recordedActions.length,
  };
}

async function saveMacro(name, description) {
  const macro = {
    id: `macro_${Date.now()}`,
    name: name || `Macro ${state.savedMacros.length + 1}`,
    description: description || '',
    actions: [...state.recordedActions],
    createdAt: Date.now(),
    playCount: 0,
  };

  state.savedMacros.push(macro);
  await chrome.storage.local.set({ savedMacros: state.savedMacros });
  state.recordedActions = [];

  return { success: true, macro };
}

async function playMacro(macroId, tabId) {
  const macro = state.savedMacros.find((m) => m.id === macroId);
  if (!macro || !tabId) {
    return { success: false, error: 'Macro not found or no active tab' };
  }

  // Send actions to content script for playback
  sendToContentScript(tabId, {
    action: 'play-macro',
    actions: macro.actions,
  });

  // Update play count
  macro.playCount++;
  await chrome.storage.local.set({ savedMacros: state.savedMacros });

  return { success: true };
}

async function deleteMacro(macroId) {
  state.savedMacros = state.savedMacros.filter((m) => m.id !== macroId);
  await chrome.storage.local.set({ savedMacros: state.savedMacros });
  return { success: true };
}

// ============================================================
// AI Processing
// ============================================================

async function processAIRequest(message) {
  // This would integrate with an LLM API (OpenAI, Anthropic, etc.)
  // For now, return structured responses based on the request type
  const { type, text, imageUrl, url } = message;

  const responses = {
    summarize: `**Summary:**\n\nThe selected text discusses: "${(text || '').substring(0, 100)}..."\n\nKey points would be extracted and presented here when connected to an AI provider.`,
    explain: `**Explanation:**\n\nThis text means: "${(text || '').substring(0, 100)}..."\n\nA detailed explanation would appear here when connected to an AI provider.`,
    translate: `**Translation:**\n\nOriginal: "${(text || '').substring(0, 80)}..."\n\nTranslation would appear here when connected to an AI provider. Configure your preferred language in settings.`,
    'extract-data': `**Extracted Data:**\n\nFrom the selection, the following structured data was identified:\n\n- Entities, dates, numbers, and key-value pairs would be extracted here.`,
    'summarize-page': `**Page Summary:**\n\nThis page would be analyzed and summarized when connected to an AI provider. The summary would include main topics, key arguments, and actionable items.`,
    'extract-contacts': `**Contact Information:**\n\nEmails, phone numbers, addresses, and social profiles found on this page would be listed here.`,
    'describe-image': `**Image Description:**\n\nThe image at ${imageUrl || 'this location'} would be analyzed and described using vision AI capabilities.`,
    ocr: `**Extracted Text:**\n\nText content from the image would be extracted using OCR when connected to an AI provider.`,
    'preview-link': `**Link Preview:**\n\nContent from ${url || 'this link'} would be fetched and summarized here.`,
  };

  return {
    success: true,
    result: responses[type] || 'Action processed. Connect an AI provider in settings for full functionality.',
  };
}

// ============================================================
// Natural Language Command Processing (Concept 3)
// ============================================================

async function processNLCommand(command, tabId) {
  if (!command || !tabId) {
    return { success: false, error: 'No command or tab' };
  }

  // Parse intent from natural language
  const lowerCmd = command.toLowerCase();

  let intent = { action: 'unknown', params: {} };

  if (lowerCmd.includes('summarize') || lowerCmd.includes('summary')) {
    intent = { action: 'summarize-page', params: {} };
  } else if (lowerCmd.includes('click') || lowerCmd.includes('press')) {
    const target = command.replace(/click|press|the|button|link/gi, '').trim();
    intent = { action: 'click-element', params: { target } };
  } else if (lowerCmd.includes('fill') || lowerCmd.includes('form')) {
    intent = { action: 'smart-fill', params: {} };
  } else if (lowerCmd.includes('scroll') && lowerCmd.includes('down')) {
    intent = { action: 'scroll', params: { direction: 'down' } };
  } else if (lowerCmd.includes('scroll') && lowerCmd.includes('up')) {
    intent = { action: 'scroll', params: { direction: 'up' } };
  } else if (lowerCmd.includes('find') || lowerCmd.includes('search')) {
    const query = command.replace(/find|search|for|the/gi, '').trim();
    intent = { action: 'search-page', params: { query } };
  } else if (lowerCmd.includes('read') || lowerCmd.includes('describe')) {
    intent = { action: 'describe-page', params: {} };
  } else if (lowerCmd.includes('navigate') || lowerCmd.includes('go to')) {
    const target = command.replace(/navigate|go to|to/gi, '').trim();
    intent = { action: 'navigate', params: { target } };
  } else {
    intent = { action: 'ai-query', params: { query: command } };
  }

  sendToContentScript(tabId, {
    action: 'execute-nl-command',
    intent,
    originalCommand: command,
  });

  return { success: true, intent };
}

// ============================================================
// Utility Functions
// ============================================================

function sendToContentScript(tabId, message) {
  chrome.tabs.sendMessage(tabId, message).catch((err) => {
    console.log('Content script not ready:', err.message);
  });
}

// ============================================================
// Command Shortcuts
// ============================================================

chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    if (!tabId) return;

    switch (command) {
      case 'toggle-sidepanel':
        chrome.sidePanel.open({ tabId });
        break;
      case 'start-recording':
        toggleRecording(tabId);
        break;
    }
  });
});

// ============================================================
// Installation Handler
// ============================================================

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.local.set({
      settings: state.settings,
      savedMacros: [],
    });

    // Open options page on first install
    chrome.runtime.openOptionsPage();
  }

  setupContextMenus();
});

console.log('openPointer service worker initialized');
