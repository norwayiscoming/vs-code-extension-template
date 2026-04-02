import * as vscode from "vscode";
import type { ExtensionModule } from "../types";
import { log } from "../utils";

// ─── Decoration Manager ────────────────────────────────────────────
// Create decoration types and apply them to editors.
// Call `updateDecorations()` when document content changes.

export class DecorationManager {
  private decorationTypes = new Map<string, vscode.TextEditorDecorationType>();
  private timeout: ReturnType<typeof setTimeout> | undefined;

  createDecorationType(
    id: string,
    options: vscode.DecorationRenderOptions
  ): vscode.TextEditorDecorationType {
    const existing = this.decorationTypes.get(id);
    if (existing) {
      existing.dispose();
    }
    const type = vscode.window.createTextEditorDecorationType(options);
    this.decorationTypes.set(id, type);
    return type;
  }

  applyDecorations(
    editor: vscode.TextEditor,
    typeId: string,
    decorations: vscode.DecorationOptions[]
  ): void {
    const type = this.decorationTypes.get(typeId);
    if (type) {
      editor.setDecorations(type, decorations);
    }
  }

  triggerUpdate(editor: vscode.TextEditor | undefined, callback: (editor: vscode.TextEditor) => void): void {
    if (!editor) {
      return;
    }
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.timeout = setTimeout(() => callback(editor), 200);
  }

  dispose(): void {
    for (const type of this.decorationTypes.values()) {
      type.dispose();
    }
    this.decorationTypes.clear();
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
  }
}

// ─── Decorations Module (disabled by default) ──────────────────────

export const decorationsModule: ExtensionModule = {
  id: "decorations",
  activate(_context) {
    // const manager = new DecorationManager();
    //
    // manager.createDecorationType("highlight", {
    //   backgroundColor: "rgba(255, 255, 0, 0.2)",
    //   border: "1px solid rgba(255, 255, 0, 0.5)",
    // });
    //
    // const updateDecorations = (editor: vscode.TextEditor) => {
    //   const text = editor.document.getText();
    //   const decorations: vscode.DecorationOptions[] = [];
    //   // Find patterns and add decorations...
    //   manager.applyDecorations(editor, "highlight", decorations);
    // };
    //
    // context.subscriptions.push(
    //   vscode.window.onDidChangeActiveTextEditor((editor) =>
    //     manager.triggerUpdate(editor, updateDecorations)
    //   ),
    //   vscode.workspace.onDidChangeTextDocument((e) => {
    //     const editor = vscode.window.activeTextEditor;
    //     if (editor && e.document === editor.document) {
    //       manager.triggerUpdate(editor, updateDecorations);
    //     }
    //   }),
    //   manager
    // );
    log("Decorations module loaded (currently disabled - uncomment to enable)");
  },
};
