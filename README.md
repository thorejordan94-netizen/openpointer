# openPointer — AI-Powered Browser Extension

An AI-powered browser extension for context-aware assistance. Proactive workflow automation, intelligent macros, and enhanced accessibility — right from your cursor.

## Features

### Concept 1: Proactive Workflow Assistant
- **Contextual Action Menu** — Right-click or hover (Alt+hover) on any element for AI-generated actions
- **Smart Form Filler** — Auto-fills forms with intelligent data extraction
- **Dynamic Information Retrieval** — Summarize, explain, translate, or extract data from any selection
- **Multi-Tab Context Synthesis** — Cross-application awareness and orchestration

### Concept 2: Learning & Automation Engine
- **Action Recording** — Record browser interactions with one click
- **Intelligent Macro Playback** — Replay recorded actions with adaptive element matching
- **Macro Management** — Save, name, and organize your automation workflows
- **Community Skills** — Import pre-built automation skills (coming soon)

### Concept 3: Enhanced Accessibility & Intuitive Interaction
- **Natural Language Commands** — Type or speak commands to control the browser
- **Semantic Visual Search** — Label and identify UI elements by meaning
- **Voice Control** — Built-in speech recognition for hands-free operation
- **Accessibility Tools** — High contrast, text enlargement, read aloud, content simplification
- **Guided Navigation** — Step-by-step assistance for complex websites

## Installation

### From Source (Developer Mode)
1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked" and select the `openpointer-extension` directory
5. The extension icon will appear in your toolbar

### Configuration
1. Click the extension icon → Settings (or right-click → Options)
2. Select your AI provider (OpenAI, Anthropic, Google, or Local/Ollama)
3. Enter your API key
4. Configure features and preferences

## Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+P` | Open popup |
| `Ctrl+Shift+O` | Toggle side panel |
| `Ctrl+Shift+R` | Start/stop recording |
| `Alt + Hover` | Show contextual tooltip |
| `Escape` | Close overlay/tooltip |

## Architecture

```
openpointer-extension/
├── manifest.json          # Manifest V3 configuration
├── background/
│   └── service-worker.js  # Background service worker (message routing, macros, AI)
├── content/
│   └── content-script.js  # Content script (DOM analysis, overlays, recording)
├── popup/
│   ├── popup.html         # Extension popup UI
│   ├── popup.css
│   └── popup.js
├── sidepanel/
│   ├── sidepanel.html     # Side panel UI (chat, macros, accessibility)
│   ├── sidepanel.css
│   └── sidepanel.js
├── options/
│   ├── options.html       # Settings page
│   ├── options.css
│   └── options.js
├── styles/
│   └── content.css        # Injected content styles
├── skills/
│   └── sample-skills.json # Community skill definitions
└── icons/                 # Extension icons
```

## Technology
- **Manifest V3** — Latest Chrome extension standard
- **Service Worker** — Background processing and message routing
- **Side Panel API** — Persistent assistant panel
- **Context Menus API** — Right-click integration
- **Web Speech API** — Voice commands
- **Chrome Storage API** — Local data persistence

## Privacy
- All data stored locally in Chrome storage
- API keys never leave your browser (sent only to your configured AI provider)
- No telemetry or tracking
- Open source under MIT License

## License
MIT
