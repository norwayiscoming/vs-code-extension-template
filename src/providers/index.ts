// Re-export all provider modules for clean imports.
export { treeViewModule } from "./tree-view";
export { webviewViewModule } from "./webview-view";
export { completionModule } from "./completion";
export { codeLensModule } from "./code-lens";
export { codeActionsModule } from "./code-actions";
export { decorationsModule } from "./decorations";

// Re-export base classes for extension/inheritance.
export { BaseTreeDataProvider } from "./tree-view";
export { BaseWebviewViewProvider } from "./webview-view";
export { BaseWebviewPanel } from "./webview-panel";
export { BaseCompletionProvider } from "./completion";
export { BaseCodeLensProvider } from "./code-lens";
export { BaseCodeActionProvider } from "./code-actions";
export { DecorationManager } from "./decorations";
