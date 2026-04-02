import * as vscode from "vscode";
import type { ExtensionModule } from "../types";
import { log } from "../utils";

// ─── Status Bar Manager ────────────────────────────────────────────
// Creates and manages status bar items.
// Call `update()` to change text/tooltip dynamically.

export class StatusBarManager {
  private items = new Map<string, vscode.StatusBarItem>();

  create(
    id: string,
    options: {
      alignment?: vscode.StatusBarAlignment;
      priority?: number;
      text: string;
      tooltip?: string;
      command?: string;
    }
  ): vscode.StatusBarItem {
    const item = vscode.window.createStatusBarItem(
      options.alignment ?? vscode.StatusBarAlignment.Right,
      options.priority ?? 100
    );
    item.text = options.text;
    item.tooltip = options.tooltip;
    item.command = options.command;
    this.items.set(id, item);
    return item;
  }

  get(id: string): vscode.StatusBarItem | undefined {
    return this.items.get(id);
  }

  show(id: string): void {
    this.items.get(id)?.show();
  }

  hide(id: string): void {
    this.items.get(id)?.hide();
  }

  update(id: string, text: string, tooltip?: string): void {
    const item = this.items.get(id);
    if (item) {
      item.text = text;
      if (tooltip !== undefined) {
        item.tooltip = tooltip;
      }
    }
  }

  dispose(): void {
    for (const item of this.items.values()) {
      item.dispose();
    }
    this.items.clear();
  }
}

// ─── Status Bar Module ─────────────────────────────────────────────

export const statusBarModule: ExtensionModule = {
  id: "statusBar",
  activate(context) {
    const manager = new StatusBarManager();

    manager.create("main", {
      text: "$(zap) My Extension",
      tooltip: "My Extension is active",
      command: "myExtension.helloWorld",
    });
    manager.show("main");

    context.subscriptions.push(manager);
    log("Status bar registered");
  },
};
