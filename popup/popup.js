/**
 * openPointer — Popup Script
 * Handles quick actions, NL commands, macro management
 */

document.addEventListener('DOMContentLoaded', () => {
  // ============================================================
  // Quick Actions
  // ============================================================

  document.getElementById('btn-summarize').addEventListener('click', () => {
    sendToActiveTab({ action: 'ai-action', type: 'summarize-page' });
    window.close();
  });

  document.getElementById('btn-extract').addEventListener('click', () => {
    sendToActiveTab({ action: 'ai-action', type: 'extract-contacts' });
    window.close();
  });

  document.getElementById('btn-fill').addEventListener('click', () => {
    sendToActiveTab({ action: 'smart-fill' });
    window.close();
  });

  document.getElementById('btn-label').addEventListener('click', () => {
    sendToActiveTab({ action: 'label-elements' });
    window.close();
  });

  // ============================================================
  // Natural Language Command
  // ============================================================

  const nlInput = document.getElementById('nl-input');
  const nlSubmit = document.getElementById('nl-submit');

  function submitNLCommand() {
    const command = nlInput.value.trim();
    if (!command) return;

    chrome.runtime.sendMessage({ action: 'nl-command', command }, () => {
      window.close();
    });
  }

  nlSubmit.addEventListener('click', submitNLCommand);
  nlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitNLCommand();
  });

  // ============================================================
  // Macro Recording
  // ============================================================

  const recordBtn = document.getElementById('btn-record');
  const recordLabel = document.getElementById('record-label');
  const recDot = document.getElementById('rec-dot');

  // Get current recording state
  chrome.runtime.sendMessage({ action: 'get-recording-state' }, (response) => {
    if (response?.isRecording) {
      recordBtn.classList.add('recording');
      recordLabel.textContent = `Stop Recording (${response.actions?.length || 0} actions)`;
    }
  });

  recordBtn.addEventListener('click', async () => {
    const response = await chrome.runtime.sendMessage({ action: 'toggle-recording' });

    if (response?.isRecording) {
      recordBtn.classList.add('recording');
      recordLabel.textContent = 'Stop Recording';
    } else {
      recordBtn.classList.remove('recording');
      recordLabel.textContent = 'Start Recording';

      // If there were recorded actions, prompt to save
      if (response?.actionCount > 0) {
        const name = prompt(`Save macro? (${response.actionCount} actions recorded)\nEnter a name:`);
        if (name) {
          await chrome.runtime.sendMessage({
            action: 'save-macro',
            name,
            description: `Recorded ${response.actionCount} actions`,
          });
          loadMacros();
        }
      }
    }
  });

  // ============================================================
  // Macro List
  // ============================================================

  async function loadMacros() {
    const response = await chrome.runtime.sendMessage({ action: 'get-macros' });
    const macros = response?.macros || [];
    const list = document.getElementById('macro-list');

    if (macros.length === 0) {
      list.innerHTML = '<div style="font-size: 11px; color: #475569; text-align: center; padding: 8px;">No saved macros yet</div>';
      return;
    }

    list.innerHTML = macros
      .map(
        (macro) => `
      <div class="macro-item">
        <span class="macro-name">${escapeHtml(macro.name)}</span>
        <div class="macro-actions">
          <button class="macro-play" data-id="${macro.id}" title="Play macro">▶</button>
          <button class="macro-delete" data-id="${macro.id}" title="Delete macro">✕</button>
        </div>
      </div>
    `
      )
      .join('');

    // Play buttons
    list.querySelectorAll('.macro-play').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id) {
          await chrome.runtime.sendMessage({
            action: 'play-macro',
            macroId: btn.dataset.id,
            tabId: tabs[0].id,
          });
          window.close();
        }
      });
    });

    // Delete buttons
    list.querySelectorAll('.macro-delete').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await chrome.runtime.sendMessage({
          action: 'delete-macro',
          macroId: btn.dataset.id,
        });
        loadMacros();
      });
    });
  }

  loadMacros();

  // ============================================================
  // Footer Buttons
  // ============================================================

  document.getElementById('btn-sidepanel').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'open-sidepanel' });
    window.close();
  });

  document.getElementById('btn-settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  // ============================================================
  // Utilities
  // ============================================================

  async function sendToActiveTab(message) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, message);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
});
