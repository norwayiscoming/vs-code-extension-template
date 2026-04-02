// ─── Webview Script ────────────────────────────────────────────────
// This runs inside the webview iframe.
// Use `vscode.postMessage()` to send messages to the extension.
// Use `window.addEventListener('message', ...)` to receive messages.

(function () {
  // @ts-ignore - acquireVsCodeApi is injected by VS Code
  const vscode = acquireVsCodeApi();

  // Restore previous state if any
  const previousState = vscode.getState() || { count: 0 };
  let state = previousState;

  // ─── DOM Elements ──────────────────────────────────────────────
  const actionBtn = document.getElementById("actionBtn");
  const output = document.getElementById("output");

  // ─── Button Handler ────────────────────────────────────────────
  if (actionBtn) {
    actionBtn.addEventListener("click", () => {
      state.count++;
      vscode.setState(state);

      // Send message to extension
      vscode.postMessage({
        type: "action",
        payload: { count: state.count },
      });

      if (output) {
        output.textContent = `Action triggered ${state.count} time(s)`;
      }
    });
  }

  // ─── Receive Messages from Extension ───────────────────────────
  window.addEventListener("message", (event) => {
    const message = event.data;
    switch (message.type) {
      case "update":
        if (output) {
          output.textContent = JSON.stringify(message.payload, null, 2);
        }
        break;
    }
  });

  // Notify extension that webview is ready
  vscode.postMessage({ type: "ready" });
})();
