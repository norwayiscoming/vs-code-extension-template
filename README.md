# VS Code Extension Template

A production-ready, modular VS Code extension template with TypeScript + esbuild. Designed for extensibility, AI-assisted development, and fast marketplace publishing.

## Features

- **Modular architecture** - Every feature is a plug-and-play module
- **Extensible base classes** - Inherit and override, or use directly
- **esbuild bundling** - Fast builds, small package size
- **Full type safety** - Strict TypeScript with declaration maps
- **Test infrastructure** - Mocha + @vscode/test-electron ready to go
- **Webview support** - Sidebar panels and editor panels with CSP, messaging, state
- **Tree view** - Generic tree data provider with refresh support
- **Status bar** - Manager for creating/updating status bar items
- **Configuration** - Reactive config manager with change events
- **AI-friendly** - CLAUDE.md + SPECS.md for AI-assisted coding

## Quick Start

```bash
# Clone the template
git clone https://github.com/your-org/vs-code-extension-template.git my-extension
cd my-extension

# Install dependencies
npm install

# Open in VS Code
code .

# Press F5 to run the extension in a new VS Code window
```

## Customize

### 1. Update Identity

In `package.json`, change:
- `name` - your extension's ID (lowercase, hyphens)
- `displayName` - human-readable name
- `publisher` - your VS Code marketplace publisher ID
- `description` - what your extension does
- `repository` - your repo URL

### 2. Rename Prefixes

Replace all occurrences of `myExtension` with your extension's prefix:
- Command IDs: `myExtension.helloWorld` → `yourExt.helloWorld`
- Config keys: `myExtension.enabled` → `yourExt.enabled`
- View IDs: `myExtension.treeView` → `yourExt.treeView`

### 3. Add Your Features

```typescript
// src/commands/index.ts - Add a command
const commands: CommandDefinition[] = [
  {
    id: "yourExt.doSomething",
    handler: () => { /* your logic */ },
  },
];

// src/providers/tree-view.ts - Customize tree data
provider.setRoots([
  { id: "item1", label: "Your Item", iconPath: new vscode.ThemeIcon("file") },
]);
```

### 4. Enable Optional Modules

In each provider file, uncomment the registration code in the module's `activate()` method:
- `src/providers/completion.ts` - Autocomplete suggestions
- `src/providers/code-lens.ts` - Inline code annotations
- `src/providers/code-actions.ts` - Quick fixes and refactors
- `src/providers/decorations.ts` - Text highlighting

## Architecture

```
src/extension.ts          ← Module registry (add/remove features here)
src/types/                ← Shared interfaces
src/utils/                ← Logging, config helpers, webview utilities
src/config/               ← Reactive configuration manager
src/commands/             ← Command handlers
src/statusbar/            ← Status bar management
src/providers/            ← All VS Code providers (tree, webview, completion, etc.)
src/test/                 ← Test infrastructure
media/                    ← Icons, webview CSS/JS
```

Every feature implements `ExtensionModule`:

```typescript
interface ExtensionModule {
  readonly id: string;
  activate(context: vscode.ExtensionContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}
```

See [SPECS.md](SPECS.md) for full architecture documentation.
See [CLAUDE.md](CLAUDE.md) for AI-assisted development instructions.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run compile` | Type-check, lint, and bundle |
| `npm run watch` | Watch mode (esbuild + tsc in parallel) |
| `npm run package` | Production build (minified) |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests in VS Code |
| `npm run check-types` | TypeScript type checking only |

## Publishing

```bash
# Install the VS Code Extension CLI
npm install -g @vscode/vsce

# Package as .vsix
vsce package

# Publish to marketplace
vsce publish
```

## License

MIT - See [LICENSE](LICENSE) for details.
