import * as vscode from "vscode";
import type { ExtensionModule } from "../types";
import { log } from "../utils";

// ─── Base Completion Provider ──────────────────────────────────────
// Extend or replace to provide language-specific completions.
// Register for specific languages by changing the document selector.

export class BaseCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext
  ): vscode.CompletionItem[] {
    const linePrefix = document.lineAt(position).text.slice(0, position.character);
    return this.getCompletions(linePrefix, document, position);
  }

  resolveCompletionItem(item: vscode.CompletionItem): vscode.CompletionItem {
    return item;
  }

  protected getCompletions(
    _linePrefix: string,
    _document: vscode.TextDocument,
    _position: vscode.Position
  ): vscode.CompletionItem[] {
    // Override this method to provide custom completions.
    // Example:
    // if (linePrefix.endsWith('myApi.')) {
    //   return [new vscode.CompletionItem('doSomething', vscode.CompletionItemKind.Method)];
    // }
    return [];
  }
}

// ─── Completion Module (disabled by default) ───────────────────────
// Uncomment and customize to enable completions.

export const completionModule: ExtensionModule = {
  id: "completion",
  activate(_context) {
    // const provider = new BaseCompletionProvider();
    // context.subscriptions.push(
    //   vscode.languages.registerCompletionItemProvider(
    //     { scheme: "file", language: "typescript" },
    //     provider,
    //     "." // trigger character
    //   )
    // );
    log("Completion module loaded (currently disabled - uncomment to enable)");
  },
};
