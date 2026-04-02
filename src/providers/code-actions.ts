import * as vscode from "vscode";
import type { ExtensionModule } from "../types";
import { log } from "../utils";

// ─── Base Code Action Provider ─────────────────────────────────────
// Override `provideCodeActions()` to provide quick fixes, refactors, etc.

export class BaseCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
    vscode.CodeActionKind.Refactor,
  ];

  provideCodeActions(
    _document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    _context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    // Override to provide code actions.
    // Example: return quick fixes for diagnostics.
    return [];
  }
}

// ─── Code Actions Module (disabled by default) ─────────────────────

export const codeActionsModule: ExtensionModule = {
  id: "codeActions",
  activate(_context) {
    // const provider = new BaseCodeActionProvider();
    // context.subscriptions.push(
    //   vscode.languages.registerCodeActionsProvider("*", provider, {
    //     providedCodeActionKinds: BaseCodeActionProvider.providedCodeActionKinds,
    //   })
    // );
    log("CodeActions module loaded (currently disabled - uncomment to enable)");
  },
};
