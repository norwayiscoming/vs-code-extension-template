import * as vscode from "vscode";

// ─── Extension Module System ───────────────────────────────────────
// Every feature is a Module. Register modules in extension.ts.
// This makes the extension infinitely extensible.

export interface ExtensionModule {
  /** Unique identifier for this module */
  readonly id: string;
  /** Called when the extension activates. Register commands, providers, etc. */
  activate(context: vscode.ExtensionContext): void | Promise<void>;
  /** Called when the extension deactivates. Optional cleanup. */
  deactivate?(): void | Promise<void>;
}

// ─── Tree View ─────────────────────────────────────────────────────

export interface TreeNode {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly tooltip?: string;
  readonly iconPath?: vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri };
  readonly collapsibleState?: vscode.TreeItemCollapsibleState;
  readonly contextValue?: string;
  readonly command?: vscode.Command;
  readonly children?: TreeNode[];
}

// ─── Webview ───────────────────────────────────────────────────────

export interface WebviewMessage {
  readonly type: string;
  readonly payload?: unknown;
}

// ─── Configuration ─────────────────────────────────────────────────

export interface ExtensionConfig {
  enabled: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
}

// ─── Command Handler ───────────────────────────────────────────────

export interface CommandDefinition {
  readonly id: string;
  readonly handler: (...args: unknown[]) => unknown;
}
