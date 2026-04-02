import * as vscode from "vscode";
import type { WebviewMessage } from "../types";
import { getNonce, getUri, log } from "../utils";

// ─── Base Webview Panel ────────────────────────────────────────────
// Use this for full editor panels (not sidebar).
// Singleton pattern: `createOrShow()` reuses existing panel.

export class BaseWebviewPanel {
  private static instances = new Map<string, BaseWebviewPanel>();
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  protected constructor(
    private readonly _id: string,
    panel: vscode.WebviewPanel,
    protected readonly extensionUri: vscode.Uri
  ) {
    this._panel = panel;
    this._panel.webview.html = this.getHtmlContent(this._panel.webview);

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => this.onMessage(message),
      null,
      this._disposables
    );
  }

  static createOrShow(
    id: string,
    extensionUri: vscode.Uri,
    title: string,
    column = vscode.ViewColumn.One
  ): BaseWebviewPanel {
    const existing = BaseWebviewPanel.instances.get(id);
    if (existing) {
      existing._panel.reveal(column);
      return existing;
    }

    const panel = vscode.window.createWebviewPanel(id, title, column, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
    });

    const instance = new BaseWebviewPanel(id, panel, extensionUri);
    BaseWebviewPanel.instances.set(id, instance);
    return instance;
  }

  postMessage(message: WebviewMessage): void {
    this._panel.webview.postMessage(message);
  }

  protected onMessage(message: WebviewMessage): void {
    log(`Panel message: ${message.type}`);
  }

  protected getHtmlContent(webview: vscode.Webview): string {
    const nonce = getNonce();
    const styleUri = getUri(webview, this.extensionUri, ["media", "webview", "main.css"]);
    const scriptUri = getUri(webview, this.extensionUri, ["media", "webview", "main.js"]);

    return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
        <link href="${styleUri}" rel="stylesheet">
        <title>Panel</title>
      </head>
      <body>
        <div id="root">
          <h1>Extension Panel</h1>
          <p>Override <code>getHtmlContent()</code> in your subclass.</p>
        </div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>
    `;
  }

  dispose(): void {
    BaseWebviewPanel.instances.delete(this._id);
    this._panel.dispose();
    for (const d of this._disposables) {
      d.dispose();
    }
    this._disposables = [];
  }
}
