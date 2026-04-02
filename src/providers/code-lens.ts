import * as vscode from "vscode";
import type { ExtensionModule } from "../types";
import { log } from "../utils";

// ─── Base Code Lens Provider ───────────────────────────────────────
// Override `provideCodeLenses()` to scan documents and return lenses.

export class BaseCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(
    _document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    // Override to provide code lenses.
    // Example: find all functions and add a "Run" lens above each.
    return [];
  }

  resolveCodeLens(codeLens: vscode.CodeLens, _token: vscode.CancellationToken): vscode.CodeLens {
    codeLens.command = codeLens.command ?? {
      title: "Action",
      command: "myExtension.helloWorld",
    };
    return codeLens;
  }

  dispose(): void {
    this._onDidChangeCodeLenses.dispose();
  }
}

// ─── Code Lens Module (disabled by default) ────────────────────────

export const codeLensModule: ExtensionModule = {
  id: "codeLens",
  activate(_context) {
    // const provider = new BaseCodeLensProvider();
    // context.subscriptions.push(
    //   vscode.languages.registerCodeLensProvider("*", provider),
    //   provider
    // );
    log("CodeLens module loaded (currently disabled - uncomment to enable)");
  },
};
