import * as vscode from "vscode";
import type { ExtensionModule } from "./types";
import { log } from "./utils";

// ─── Module Imports ────────────────────────────────────────────────
import { configModule } from "./config";
import { commandsModule } from "./commands";
import { statusBarModule } from "./statusbar";
import {
  treeViewModule,
  webviewViewModule,
  completionModule,
  codeLensModule,
  codeActionsModule,
  decorationsModule,
} from "./providers";

// ─── Module Registry ───────────────────────────────────────────────
// Add or remove modules here to enable/disable features.
// Order matters: config should load first.

const modules: ExtensionModule[] = [
  configModule,
  commandsModule,
  statusBarModule,
  treeViewModule,
  webviewViewModule,
  // ── Optional modules (uncomment to enable) ──
  completionModule,
  codeLensModule,
  codeActionsModule,
  decorationsModule,
];

// ─── Activation ────────────────────────────────────────────────────

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  log("Activating extension...");

  for (const mod of modules) {
    try {
      await mod.activate(context);
      log(`Module "${mod.id}" activated`);
    } catch (err) {
      log(`Failed to activate module "${mod.id}": ${err}`, "error");
    }
  }

  log(`Extension activated with ${modules.length} modules`);
}

// ─── Deactivation ──────────────────────────────────────────────────

export async function deactivate(): Promise<void> {
  for (const mod of modules.reverse()) {
    try {
      await mod.deactivate?.();
    } catch (err) {
      log(`Failed to deactivate module "${mod.id}": ${err}`, "error");
    }
  }
}
