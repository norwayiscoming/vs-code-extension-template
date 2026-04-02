import * as vscode from "vscode";
import type { ExtensionModule, WebviewMessage } from "../types";
import { getNonce, getUri, log } from "../utils";

// ─── Base Webview View Provider ────────────────────────────────────
// Extend this class for custom sidebar webviews.
// Override `getHtmlContent()` to provide custom HTML.
// Use `postMessage()` / `onMessage()` for two-way communication.

export class BaseWebviewViewProvider implements vscode.WebviewViewProvider {
  protected _view?: vscode.WebviewView;

  constructor(protected readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")],
    };

    webviewView.webview.html = this.getHtmlContent(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message: WebviewMessage) => {
      this.onMessage(message);
    });
  }

  postMessage(message: WebviewMessage): void {
    this._view?.webview.postMessage(message);
  }

  protected onMessage(message: WebviewMessage): void {
    log(`Webview message: ${message.type}`);
    switch (message.type) {
      case "ready":
        log("Webview is ready");
        break;
      case "action":
        vscode.window.showInformationMessage(`Action: ${JSON.stringify(message.payload)}`);
        break;
    }
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
        <title>My Extension</title>
      </head>
      <body>
        <div id="root">
          <h2>My Extension</h2>
          <p>Edit <code>src/providers/webview-view.ts</code> to customize this panel.</p>
          <button id="actionBtn">Run Action</button>
          <div id="output"></div>
        </div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>
    `;
  }
}

// ─── Webview View Module ───────────────────────────────────────────

export const webviewViewModule: ExtensionModule = {
  id: "webviewView",
  activate(context) {
    const provider = new BaseWebviewViewProvider(context.extensionUri);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider("myExtension.webviewView", provider)
    );
    log("Webview view registered");
  },
};
