/**
 * openPointer — Options Page Script
 * Handles settings persistence and data management
 */

document.addEventListener('DOMContentLoaded', () => {
  const elements = {
    provider: document.getElementById('ai-provider'),
    apiKey: document.getElementById('api-key'),
    localUrl: document.getElementById('local-url'),
    localUrlGroup: document.getElementById('local-url-group'),
    contextMenu: document.getElementById('opt-context-menu'),
    predictive: document.getElementById('opt-predictive'),
    accessibility: document.getElementById('opt-accessibility'),
    saveBtn: document.getElementById('btn-save'),
    saveStatus: document.getElementById('save-status'),
    exportBtn: document.getElementById('btn-export'),
    clearBtn: document.getElementById('btn-clear'),
  };

  // Load settings
  chrome.runtime.sendMessage({ action: 'get-settings' }, (response) => {
    if (!response?.settings) return;
    const s = response.settings;

    elements.provider.value = s.aiProvider || 'none';
    elements.apiKey.value = s.apiKey || '';
    elements.contextMenu.checked = s.contextMenuEnabled !== false;
    elements.predictive.checked = s.predictiveEnabled !== false;
    elements.accessibility.checked = s.accessibilityMode === true;

    toggleLocalUrl();
  });

  // Show/hide local URL field
  elements.provider.addEventListener('change', toggleLocalUrl);

  function toggleLocalUrl() {
    elements.localUrlGroup.style.display =
      elements.provider.value === 'local' ? 'block' : 'none';
  }

  // Save settings
  elements.saveBtn.addEventListener('click', async () => {
    const settings = {
      aiProvider: elements.provider.value,
      apiKey: elements.apiKey.value,
      contextMenuEnabled: elements.contextMenu.checked,
      predictiveEnabled: elements.predictive.checked,
      accessibilityMode: elements.accessibility.checked,
    };

    if (elements.provider.value === 'local') {
      settings.localUrl = elements.localUrl.value;
    }

    const response = await chrome.runtime.sendMessage({
      action: 'save-settings',
      settings,
    });

    if (response?.success) {
      elements.saveStatus.textContent = 'Settings saved!';
      setTimeout(() => {
        elements.saveStatus.textContent = '';
      }, 3000);
    }
  });

  // Export data
  elements.exportBtn.addEventListener('click', async () => {
    chrome.storage.local.get(null, (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `openpointer-data-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  });

  // Clear data
  elements.clearBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all data? This will delete all saved macros and settings.')) {
      chrome.storage.local.clear(() => {
        elements.saveStatus.textContent = 'All data cleared.';
        setTimeout(() => location.reload(), 1000);
      });
    }
  });
});
