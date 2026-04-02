# VS Code Extension Template - Architecture Specification

## 1. Design Philosophy

### Modular by Default
Every feature is an independent `ExtensionModule`. Modules can be added, removed, or replaced without touching other code. This enables:
- Feature flags (just comment out a module)
- Easy testing (test modules in isolation)
- Plugin-like architecture within a single extension

### Extensible Base Classes
All providers use `Base*` classes that can be:
- **Used directly** with configuration
- **Extended** via inheritance for custom behavior
- **Replaced** entirely with a new implementation

### Convention over Configuration
- Consistent naming: `myExtension.*` prefix
- Consistent file structure: one module per file
- Consistent patterns: event emitters, disposable management

## 2. Module Lifecycle

```
Extension Activate
  ├── configModule.activate()      ← Config loads first
  ├── commandsModule.activate()    ← Commands register
  ├── statusBarModule.activate()   ← UI elements appear
  ├── treeViewModule.activate()    ← Sidebar tree populates
  ├── webviewViewModule.activate() ← Sidebar webview initializes
  └── [optional modules...]        ← Additional features

Extension Deactivate
  └── modules.reverse().forEach(m => m.deactivate())
```

## 3. Directory Layout

```
vs-code-extension-template/
├── .vscode/                    # VS Code workspace config
│   ├── launch.json             # Debug configurations (F5)
│   ├── tasks.json              # Build tasks
│   ├── settings.json           # Editor settings
│   └── extensions.json         # Recommended extensions
├── src/                        # TypeScript source
│   ├── extension.ts            # Entry point & module registry
│   ├── types/                  # Shared interfaces
│   │   └── index.ts
│   ├── utils/                  # Shared utilities
│   │   └── index.ts
│   ├── config/                 # Configuration management
│   │   └── index.ts
│   ├── commands/               # Command handlers
│   │   └── index.ts
│   ├── statusbar/              # Status bar management
│   │   └── index.ts
│   ├── providers/              # VS Code API providers
│   │   ├── index.ts            # Re-exports
│   │   ├── tree-view.ts        # TreeDataProvider
│   │   ├── webview-view.ts     # WebviewViewProvider (sidebar)
│   │   ├── webview-panel.ts    # WebviewPanel (editor)
│   │   ├── completion.ts       # CompletionItemProvider
│   │   ├── code-lens.ts        # CodeLensProvider
│   │   ├── code-actions.ts     # CodeActionProvider
│   │   └── decorations.ts      # TextEditorDecorationType
│   └── test/                   # Tests
│       ├── runTest.ts
│       └── suite/
│           ├── index.ts
│           └── extension.test.ts
├── media/                      # Static assets
│   ├── sidebar-icon.svg
│   └── webview/
│       ├── main.css
│       └── main.js
├── dist/                       # Bundled output (esbuild)
├── out/                        # Compiled output (tsc, for tests)
├── package.json                # Extension manifest
├── tsconfig.json               # TypeScript config
├── esbuild.js                  # Build script
├── eslint.config.mjs           # Linting
├── .vscode-test.mjs            # Test runner config
├── .vscodeignore               # Files excluded from .vsix
├── .gitignore
├── CLAUDE.md                   # AI coding instructions
├── SPECS.md                    # This file
├── README.md                   # User documentation
└── LICENSE
```

## 4. Extension Points Reference

### 4.1 Commands
**Location:** `src/commands/index.ts`
**package.json:** `contributes.commands`
**Pattern:** Push `CommandDefinition` to the commands array.

### 4.2 Tree Views
**Location:** `src/providers/tree-view.ts`
**package.json:** `contributes.views`, `contributes.viewsContainers`
**Base class:** `BaseTreeDataProvider`
**Key methods:** `setRoots()`, `refresh()`, `getChildren()`, `getTreeItem()`

### 4.3 Webview Views (Sidebar)
**Location:** `src/providers/webview-view.ts`
**package.json:** `contributes.views` with `type: "webview"`
**Base class:** `BaseWebviewViewProvider`
**Key methods:** `getHtmlContent()`, `onMessage()`, `postMessage()`

### 4.4 Webview Panels (Editor)
**Location:** `src/providers/webview-panel.ts`
**Pattern:** `BaseWebviewPanel.createOrShow()` (singleton per id)
**Key methods:** `getHtmlContent()`, `onMessage()`, `postMessage()`

### 4.5 Completion Provider
**Location:** `src/providers/completion.ts`
**Base class:** `BaseCompletionProvider`
**Key method:** `getCompletions(linePrefix, document, position)`

### 4.6 CodeLens Provider
**Location:** `src/providers/code-lens.ts`
**Base class:** `BaseCodeLensProvider`
**Key methods:** `provideCodeLenses()`, `resolveCodeLens()`, `refresh()`

### 4.7 Code Action Provider
**Location:** `src/providers/code-actions.ts`
**Base class:** `BaseCodeActionProvider`
**Key method:** `provideCodeActions()`

### 4.8 Decorations
**Location:** `src/providers/decorations.ts`
**Class:** `DecorationManager`
**Key methods:** `createDecorationType()`, `applyDecorations()`, `triggerUpdate()`

### 4.9 Status Bar
**Location:** `src/statusbar/index.ts`
**Class:** `StatusBarManager`
**Key methods:** `create()`, `show()`, `hide()`, `update()`

### 4.10 Configuration
**Location:** `src/config/index.ts`
**Class:** `ConfigManager`
**Key:** `configManager.current` for cached config, `configManager.onDidChange` for reactive updates.

## 5. How to Scale

### Adding a new provider type (e.g., Hover, Diagnostic, Formatter)
1. Create `src/providers/your-provider.ts`
2. Create a `Base*` class implementing the VS Code provider interface
3. Export an `ExtensionModule` that registers it
4. Re-export from `src/providers/index.ts`
5. Add to `modules` array in `src/extension.ts`

### Adding a Language Server (LSP)
1. Create `server/` directory with its own `package.json` and `tsconfig.json`
2. Implement server with `vscode-languageserver`
3. Create client module in `src/providers/lsp-client.ts`
4. Use `LanguageClient` from `vscode-languageclient/node`
5. Register as an `ExtensionModule`

### Adding MCP Integration
1. Add `.mcp.json` to root or configure in `package.json`
2. Use proposed API `vscode.lm.registerMcpServerDefinitionProvider()`

### Adding Chat Participant
1. Create `src/providers/chat.ts`
2. Use `vscode.chat.createChatParticipant()`
3. Implement `ChatRequestHandler`

## 6. Publishing Checklist

- [ ] Update `name`, `displayName`, `publisher`, `description` in `package.json`
- [ ] Update `repository` URL
- [ ] Replace `media/sidebar-icon.svg` with your icon
- [ ] Add `media/icon.png` (128x128) for marketplace
- [ ] Replace all `myExtension` prefixes with your extension's prefix
- [ ] Replace `your-publisher-id` with your VS Code marketplace publisher
- [ ] Remove unused modules from `src/extension.ts`
- [ ] Remove sample tree data from `src/providers/tree-view.ts`
- [ ] Run `npm run package` to verify production build
- [ ] Run `npm test` to verify tests pass
- [ ] Install `vsce`: `npm install -g @vscode/vsce`
- [ ] Package: `vsce package`
- [ ] Publish: `vsce publish`
