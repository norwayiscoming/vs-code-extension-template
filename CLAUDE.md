# VS Code Extension Template - AI Coding Instructions

## Project Overview

This is a modular VS Code extension template using TypeScript + esbuild. Every feature is an `ExtensionModule` registered in `src/extension.ts`. The architecture is designed for easy extension, inheritance, and scaling.

## Architecture

```
src/
  extension.ts        ← Entry point. Registers modules. Add new modules here.
  types/index.ts      ← All interfaces. ExtensionModule is the core abstraction.
  utils/index.ts      ← Logging, config helpers, nonce, URI helpers, DisposableStore.
  config/index.ts     ← Reactive ConfigManager with onDidChange event.
  commands/index.ts   ← Command registry. Add commands to the `commands` array.
  statusbar/index.ts  ← StatusBarManager. Create/show/hide/update status bar items.
  providers/
    index.ts          ← Re-exports all provider modules and base classes.
    tree-view.ts      ← BaseTreeDataProvider - generic tree with refresh/setRoots.
    webview-view.ts   ← BaseWebviewViewProvider - sidebar webview with messaging.
    webview-panel.ts  ← BaseWebviewPanel - editor panel with singleton pattern.
    completion.ts     ← BaseCompletionProvider - override getCompletions().
    code-lens.ts      ← BaseCodeLensProvider - override provideCodeLenses().
    code-actions.ts   ← BaseCodeActionProvider - override provideCodeActions().
    decorations.ts    ← DecorationManager - create types, apply, throttled updates.
  test/
    runTest.ts        ← Test runner entry point.
    suite/index.ts    ← Mocha test suite loader.
    suite/*.test.ts   ← Test files.
media/
  webview/main.css    ← Webview styles using VS Code CSS variables.
  webview/main.js     ← Webview script with vscode.postMessage/getState/setState.
  sidebar-icon.svg    ← Activity bar icon.
```

## Module System

Every feature implements `ExtensionModule` from `src/types/index.ts`:

```typescript
interface ExtensionModule {
  readonly id: string;
  activate(context: vscode.ExtensionContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}
```

To add a new feature:
1. Create a new file in the appropriate directory
2. Export an `ExtensionModule` constant
3. Import and add it to the `modules` array in `src/extension.ts`

To disable a feature: remove it from the `modules` array.

## Key Conventions

### Naming
- Command IDs: `myExtension.camelCaseName`
- Config keys: `myExtension.camelCaseName`
- View IDs: `myExtension.camelCaseName`
- File names: `kebab-case.ts`
- Classes: `PascalCase` with `Base` prefix for extensible base classes

### When Adding a Command
1. Add handler to `src/commands/index.ts` commands array
2. Add contribution to `package.json` → `contributes.commands`
3. Add menu entry if needed → `contributes.menus`

### When Adding a View
1. Add view container to `package.json` → `contributes.viewsContainers` (if new sidebar)
2. Add view to `package.json` → `contributes.views`
3. Create provider in `src/providers/`
4. Export module from `src/providers/index.ts`
5. Register in `src/extension.ts` modules array

### When Adding Configuration
1. Add property to `package.json` → `contributes.configuration.properties`
2. Add type to `ExtensionConfig` in `src/types/index.ts`
3. Add parsing to `ConfigManager.reload()` in `src/config/index.ts`

### When Adding a Webview
1. Use `BaseWebviewViewProvider` for sidebar panels
2. Use `BaseWebviewPanel` for editor panels
3. Put assets in `media/webview/`
4. Always use nonce-based CSP (see `getNonce()` in utils)
5. Use `webview.asWebviewUri()` for local resource URIs

### When Adding Tests
1. Create `src/test/suite/your-feature.test.ts`
2. Use Mocha `suite()`/`test()` (TDD style)
3. Run with `npm test`

## Build System

- **esbuild** bundles `src/extension.ts` → `dist/extension.js` (single file)
- **tsc** runs in parallel for type checking only (no emit)
- `npm run watch` runs both in parallel
- `npm run package` produces minified production build
- `vscode` module is always external (provided by VS Code runtime)

## Package.json Rules

- `main` points to `./dist/extension.js` (bundled output)
- `activationEvents` should be empty array `[]` (VS Code infers from contributions)
- `engines.vscode` must match minimum supported version
- All commands must be in both `contributes.commands` AND registered via `registerCommand()`

## Common Patterns

### Disposables
Always push disposables to `context.subscriptions` for cleanup:
```typescript
context.subscriptions.push(disposable1, disposable2);
```

### Event Emitters
```typescript
private _onDidChange = new vscode.EventEmitter<T>();
readonly onDidChange = this._onDidChange.event;
```

### Webview Messaging
Extension → Webview: `provider.postMessage({ type: 'update', payload: data })`
Webview → Extension: `vscode.postMessage({ type: 'action', payload: data })`

## Do NOT

- Do not import from `dist/` or `out/` directories
- Do not use `require()` - use ES imports
- Do not hardcode file paths - use `vscode.Uri.joinPath()`
- Do not skip CSP in webviews
- Do not forget to add commands to both `package.json` and the command registry
- Do not use `*` activation event unless absolutely necessary
