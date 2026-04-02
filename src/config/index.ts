import * as vscode from "vscode";
import type { ExtensionConfig, ExtensionModule } from "../types";
import { log } from "../utils";

// ─── Reactive Configuration ────────────────────────────────────────
// Reads config once, caches it, and re-reads on change.
// Subscribe to `onDidChange` for reactive updates.

class ConfigManager {
  private _config!: ExtensionConfig;
  private readonly _onDidChange = new vscode.EventEmitter<ExtensionConfig>();
  readonly onDidChange = this._onDidChange.event;

  constructor() {
    this.reload();
  }

  get current(): ExtensionConfig {
    return this._config;
  }

  reload(): void {
    const ws = vscode.workspace.getConfiguration("myExtension");
    this._config = {
      enabled: ws.get<boolean>("enabled", true),
      logLevel: ws.get<ExtensionConfig["logLevel"]>("logLevel", "info"),
    };
    this._onDidChange.fire(this._config);
  }

  async update<K extends keyof ExtensionConfig>(
    key: K,
    value: ExtensionConfig[K],
    target = vscode.ConfigurationTarget.Global
  ): Promise<void> {
    await vscode.workspace.getConfiguration("myExtension").update(key, value, target);
    // `onDidChangeConfiguration` will trigger `reload()` via the module
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}

export const configManager = new ConfigManager();

// ─── Config Module ─────────────────────────────────────────────────

export const configModule: ExtensionModule = {
  id: "config",
  activate(context) {
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("myExtension")) {
          configManager.reload();
          log("Configuration reloaded");
        }
      }),
      configManager
    );
  },
};
