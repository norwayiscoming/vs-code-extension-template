import * as vscode from "vscode";
import type { SearchResult, SessionRegistryEntry } from "../types";
import { SearchPipeline } from "../search/pipeline";

// ─── Session Search View ───────────────────────────────────────────
// Quick pick interface for searching across sessions.

export class SessionSearchView {
  private pipeline: SearchPipeline;

  constructor(projectRoot: string) {
    this.pipeline = new SearchPipeline(projectRoot);
  }

  async show(): Promise<void> {
    const query = await vscode.window.showInputBox({
      prompt: "Search across sessions",
      placeHolder: "e.g. authentication, Brian, src/auth/...",
    });

    if (!query) {
      return;
    }

    const results = this.pipeline.search({ text: query });

    if (results.length === 0) {
      vscode.window.showInformationMessage(`No sessions found for "${query}"`);
      return;
    }

    const items = results.map((r) => this.resultToQuickPick(r));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `${results.length} sessions found`,
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (selected) {
      await this.showSessionDetail(selected.sessionId);
    }
  }

  private resultToQuickPick(result: SearchResult): vscode.QuickPickItem & { sessionId: string } {
    const time = new Date(result.identity.startedAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const statusIcon = result.identity.status === "active" ? "$(circle-filled)" : "$(history)";
    const matchedIn = result.matchedIn.join(", ");

    return {
      sessionId: result.sessionId,
      label: `${statusIcon} ${result.identity.identity.user} - ${result.identity.title}`,
      description: `${time} | score: ${result.score}`,
      detail: `Matched in: ${matchedIn} | ${result.snippet.slice(0, 120)}`,
    };
  }

  private async showSessionDetail(sessionId: string): Promise<void> {
    const registry = this.pipeline.loadRegistry();
    if (!registry || !registry.sessions[sessionId]) {
      return;
    }

    const entry = registry.sessions[sessionId];
    const actions = [
      "Copy Summary to Clipboard",
      "Copy as Context for Claude",
      "View Full Session",
    ];

    const action = await vscode.window.showQuickPick(actions, {
      placeHolder: `${entry.identity.user} - ${entry.title}`,
    });

    switch (action) {
      case "Copy Summary to Clipboard":
        await this.copySummary(sessionId, entry);
        break;
      case "Copy as Context for Claude":
        await this.copyAsContext(sessionId, entry);
        break;
      case "View Full Session":
        vscode.window.showInformationMessage(
          `Full session viewer coming in v0.3. Session: ${sessionId.slice(0, 8)}`
        );
        break;
    }
  }

  private async copySummary(_sessionId: string, entry: SessionRegistryEntry): Promise<void> {
    const summary = [
      `**${entry.identity.user}** - ${entry.title}`,
      `Branch: ${entry.branch}`,
      `Files: ${entry.files.join(", ")}`,
      `Tags: ${entry.tags.join(", ")}`,
    ].join("\n");

    await vscode.env.clipboard.writeText(summary);
    vscode.window.showInformationMessage("Summary copied to clipboard");
  }

  private async copyAsContext(_sessionId: string, entry: SessionRegistryEntry): Promise<void> {
    const context = [
      `[From session "${entry.title}" by ${entry.identity.user} on ${new Date(entry.startedAt).toLocaleDateString()}]:`,
      `- Branch: ${entry.branch}`,
      `- Files modified: ${entry.files.join(", ")}`,
      `- Topics: ${entry.tags.join(", ")}`,
    ].join("\n");

    await vscode.env.clipboard.writeText(context);
    vscode.window.showInformationMessage("Context copied - paste into your Claude session");
  }
}
