/**
 * openPointer — Side Panel Script
 * Full-featured assistant panel with chat, macros, and accessibility tools
 */

document.addEventListener('DOMContentLoaded', () => {
  // ============================================================
  // Tab Navigation
  // ============================================================

  const tabs = document.querySelectorAll('.sp-tab');
  const contents = document.querySelectorAll('.sp-content');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      contents.forEach((c) => c.classList.add('hidden'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.remove('hidden');
    });
  });

  // ============================================================
  // Page Info
  // ============================================================

  async function loadPageInfo() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab) return;

      document.getElementById('page-title').textContent = tab.title || 'Untitled';
      document.getElementById('page-url').textContent = tab.url || '';

      // Get detailed page info from content script
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'get-page-info' }, (response) => {
          if (chrome.runtime.lastError || !response) return;
          document.getElementById('page-stats').innerHTML = `
            <span class="page-stat">🔗 ${response.linkCount} links</span>
            <span class="page-stat">🖼️ ${response.imageCount} images</span>
            <span class="page-stat">📝 ${response.formCount} forms</span>
          `;
        });
      }
    } catch (err) {
      console.log('Could not load page info:', err);
    }
  }

  loadPageInfo();

  // Refresh page info when tab changes
  chrome.tabs.onActivated.addListener(loadPageInfo);
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete') loadPageInfo();
  });

  // ============================================================
  // Chat / AI Assistant
  // ============================================================

  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const chatSend = document.getElementById('chat-send');

  function addChatMessage(text, role) {
    const msg = document.createElement('div');
    msg.className = `chat-msg ${role}`;
    msg.innerHTML = `<div class="chat-bubble">${formatText(text)}</div>`;
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function formatText(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  async function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    addChatMessage(text, 'user');
    chatInput.value = '';

    // Process as NL command
    const response = await chrome.runtime.sendMessage({
      action: 'nl-command',
      command: text,
    });

    if (response?.intent) {
      const intentDescriptions = {
        'summarize-page': 'Summarizing the current page...',
        'click-element': `Looking for "${response.intent.params.target}" to click...`,
        'smart-fill': 'Filling forms with smart data...',
        'scroll': `Scrolling ${response.intent.params.direction}...`,
        'search-page': `Searching for "${response.intent.params.query}"...`,
        'describe-page': 'Analyzing page structure...',
        'navigate': `Navigating to "${response.intent.params.target}"...`,
        'ai-query': 'Processing your request...',
      };

      addChatMessage(
        intentDescriptions[response.intent.action] ||
          'Processing your command. Check the page for results.',
        'assistant'
      );
    } else {
      addChatMessage(
        'I processed your request. Check the page for any results.',
        'assistant'
      );
    }
  }

  chatSend.addEventListener('click', sendChatMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });

  // ============================================================
  // Quick Actions
  // ============================================================

  document.querySelectorAll('.sp-action-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;
      if (!tabId) return;

      if (action === 'smart-fill') {
        chrome.tabs.sendMessage(tabId, { action: 'smart-fill' });
      } else if (action === 'label-elements') {
        chrome.tabs.sendMessage(tabId, { action: 'label-elements' });
      } else if (action === 'describe-page') {
        chrome.tabs.sendMessage(tabId, {
          action: 'execute-nl-command',
          intent: { action: 'describe-page', params: {} },
          originalCommand: 'describe this page',
        });
      } else {
        chrome.tabs.sendMessage(tabId, {
          action: 'ai-action',
          type: action,
        });
      }

      addChatMessage(`Executing: ${btn.textContent.trim()}`, 'assistant');
    });
  });

  // ============================================================
  // Macro Recording
  // ============================================================

  const spRecordBtn = document.getElementById('sp-record-btn');
  const spRecordLabel = document.getElementById('sp-record-label');

  // Get initial state
  chrome.runtime.sendMessage({ action: 'get-recording-state' }, (response) => {
    if (response?.isRecording) {
      spRecordBtn.classList.add('recording');
      spRecordLabel.textContent = 'Stop Recording';
    }
  });

  spRecordBtn.addEventListener('click', async () => {
    const response = await chrome.runtime.sendMessage({ action: 'toggle-recording' });

    if (response?.isRecording) {
      spRecordBtn.classList.add('recording');
      spRecordLabel.textContent = 'Stop Recording';
    } else {
      spRecordBtn.classList.remove('recording');
      spRecordLabel.textContent = 'Start Recording';

      if (response?.actionCount > 0) {
        const name = prompt(`Save macro? (${response.actionCount} actions)\nEnter a name:`);
        if (name) {
          await chrome.runtime.sendMessage({
            action: 'save-macro',
            name,
            description: `${response.actionCount} recorded actions`,
          });
          loadMacros();
        }
      }
    }
  });

  // Load macros
  async function loadMacros() {
    const response = await chrome.runtime.sendMessage({ action: 'get-macros' });
    const macros = response?.macros || [];
    const list = document.getElementById('sp-macro-list');

    if (macros.length === 0) {
      list.innerHTML = '<div class="sp-empty">No saved macros yet. Start recording to create one.</div>';
      return;
    }

    list.innerHTML = macros
      .map(
        (macro) => `
      <div class="sp-macro-item">
        <div class="sp-macro-info">
          <div class="sp-macro-name">${escapeHtml(macro.name)}</div>
          <div class="sp-macro-meta">${macro.actions.length} actions · Played ${macro.playCount}x</div>
        </div>
        <div style="display:flex;gap:4px;">
          <button class="sp-action-btn sp-macro-play" data-id="${macro.id}">▶ Play</button>
          <button class="sp-action-btn sp-macro-del" data-id="${macro.id}" style="color:#fca5a5;">✕</button>
        </div>
      </div>
    `
      )
      .join('');

    list.querySelectorAll('.sp-macro-play').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id) {
          await chrome.runtime.sendMessage({
            action: 'play-macro',
            macroId: btn.dataset.id,
            tabId: tabs[0].id,
          });
        }
      });
    });

    list.querySelectorAll('.sp-macro-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await chrome.runtime.sendMessage({ action: 'delete-macro', macroId: btn.dataset.id });
        loadMacros();
      });
    });
  }

  loadMacros();

  // ============================================================
  // Accessibility Tools
  // ============================================================

  // Voice command
  const voiceBtn = document.getElementById('voice-btn');
  const voiceLabel = document.getElementById('voice-label');
  let recognition = null;

  voiceBtn.addEventListener('click', () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      voiceLabel.textContent = 'Speech recognition not supported';
      return;
    }

    if (recognition) {
      recognition.stop();
      recognition = null;
      voiceBtn.classList.remove('listening');
      voiceLabel.textContent = 'Click to speak';
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      voiceBtn.classList.add('listening');
      voiceLabel.textContent = 'Listening...';
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      voiceLabel.textContent = `"${transcript}"`;
      addChatMessage(transcript, 'user');

      chrome.runtime.sendMessage({ action: 'nl-command', command: transcript }, (response) => {
        addChatMessage('Voice command processed. Check the page for results.', 'assistant');
      });
    };

    recognition.onerror = (event) => {
      voiceLabel.textContent = `Error: ${event.error}`;
      voiceBtn.classList.remove('listening');
    };

    recognition.onend = () => {
      voiceBtn.classList.remove('listening');
      recognition = null;
      setTimeout(() => {
        voiceLabel.textContent = 'Click to speak';
      }, 3000);
    };

    recognition.start();
  });

  // Simplify content
  document.getElementById('btn-simplify').addEventListener('click', async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'ai-action',
        type: 'summarize-page',
      });
    }
  });

  // Read aloud
  document.getElementById('btn-read-aloud').addEventListener('click', async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'get-page-info' }, (response) => {
        if (response?.text) {
          const utterance = new SpeechSynthesisUtterance(response.text.substring(0, 3000));
          utterance.rate = 0.9;
          speechSynthesis.speak(utterance);
          addChatMessage('Reading page content aloud...', 'assistant');
        }
      });
    }
  });

  // High contrast
  document.getElementById('btn-high-contrast').addEventListener('click', async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          document.body.style.filter =
            document.body.style.filter === 'contrast(1.5)' ? '' : 'contrast(1.5)';
        },
      });
    }
  });

  // Large text
  document.getElementById('btn-large-text').addEventListener('click', async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          const current = parseFloat(document.body.style.fontSize) || 100;
          document.body.style.fontSize = current >= 150 ? '100%' : `${current + 25}%`;
        },
      });
    }
  });

  // Guided navigation
  document.getElementById('btn-navigate').addEventListener('click', async () => {
    const goal = document.getElementById('nav-goal').value.trim();
    if (!goal) return;

    const response = await chrome.runtime.sendMessage({
      action: 'nl-command',
      command: goal,
    });

    addChatMessage(`Navigating: "${goal}"`, 'assistant');
  });

  // ============================================================
  // Utilities
  // ============================================================

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
});
