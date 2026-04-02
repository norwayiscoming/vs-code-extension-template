import * as vscode from "vscode";
import type { SessionRegistryEntry } from "../types";
import { SearchPipeline } from "../search/pipeline";

// ─── Session Tree Data Provider ────────────────────────────────────
// Shows sessions grouped by status: Active → Recent → Older.

type TreeElement = SessionGroupNode | SessionNode | SessionDetailNode;

interface SessionGroupNode {
  type: "group";
  label: string;
  sessions: [string, SessionRegistryEntry][];
}

interface SessionNode {
  type: "session";
  sessionId: string;
  entry: SessionRegistryEntry;
}

interface SessionDetailNode {
  type: "detail";
  label: string;
  icon: string;
}

export class SessionTreeProvider implements vscode.TreeDataProvider<TreeElement> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeElement | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private pipeline: SearchPipeline;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(projectRoot: string) {
    this.pipeline = new SearchPipeline(projectRoot);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  startAutoRefresh(intervalMs = 10000): void {
    this.refreshTimer = setInterval(() => this.refresh(), intervalMs);
  }

  getTreeItem(element: TreeElement): vscode.TreeItem {
    switch (element.type) {
      case "group":
        return this.createGroupItem(element);
      case "session":
        return this.createSessionItem(element);
      case "detail":
        return this.createDetailItem(element);
    }
  }

  getChildren(element?: TreeElement): TreeElement[] {
    if (!element) {
      return this.getRootChildren();
    }

    switch (element.type) {
      case "group":
        return element.sessions.map(([id, entry]) => ({
          type: "session" as const,
          sessionId: id,
          entry,
        }));
      case "session":
        return this.getSessionDetails(element);
      default:
        return [];
    }
  }

  private getRootChildren(): SessionGroupNode[] {
    const registry = this.pipeline.loadRegistry();
    if (!registry) {
      return [];
    }

    const groups: SessionGroupNode[] = [];
    const active: [string, SessionRegistryEntry][] = [];
    const recent: [string, SessionRegistryEntry][] = [];
    const older: [string, SessionRegistryEntry][] = [];

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    for (const [id, entry] of Object.entries(registry.sessions)) {
      if (entry.status === "active") {
        active.push([id, entry]);
      } else {
        const age = now - new Date(entry.startedAt).getTime();
        if (age < oneDayMs) {
          recent.push([id, entry]);
        } else {
          older.push([id, entry]);
        }
      }
    }

    // Sort each group by time descending
    const byTime = (a: [string, SessionRegistryEntry], b: [string, SessionRegistryEntry]) =>
      b[1].startedAt.localeCompare(a[1].startedAt);

    if (active.length > 0) {
      groups.push({ type: "group", label: "Active Sessions", sessions: active.sort(byTime) });
    }
    if (recent.length > 0) {
      groups.push({ type: "group", label: "Recent (today)", sessions: recent.sort(byTime) });
    }
    if (older.length > 0) {
      groups.push({ type: "group", label: "Earlier", sessions: older.sort(byTime) });
    }

    return groups;
  }

  private getSessionDetails(session: SessionNode): SessionDetailNode[] {
    const details: SessionDetailNode[] = [];
    const entry = session.entry;

    if (entry.branch) {
      details.push({ type: "detail", label: entry.branch, icon: "git-branch" });
    }

    for (const file of entry.files.slice(0, 5)) {
      details.push({ type: "detail", label: file, icon: "file" });
    }

    if (entry.files.length > 5) {
      details.push({
        type: "detail",
        label: `+${entry.files.length - 5} more files`,
        icon: "ellipsis",
      });
    }

    return details;
  }

  private createGroupItem(group: SessionGroupNode): vscode.TreeItem {
    const item = new vscode.TreeItem(
      `${group.label} (${group.sessions.length})`,
      vscode.TreeItemCollapsibleState.Expanded
    );
    item.contextValue = "sessionGroup";
    return item;
  }

  private createSessionItem(session: SessionNode): vscode.TreeItem {
    const entry = session.entry;
    const statusIcon = entry.status === "active" ? "$(circle-filled)" : "$(circle-outline)";
    const time = new Date(entry.startedAt).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const item = new vscode.TreeItem(
      `${statusIcon} ${entry.identity.user} - ${entry.title}`,
      vscode.TreeItemCollapsibleState.Collapsed
    );

    item.description = time;
    item.tooltip = new vscode.MarkdownString(
      `**${entry.title}**\n\n` +
      `User: ${entry.identity.user}\n\n` +
      `Branch: \`${entry.branch}\`\n\n` +
      `Files: ${entry.files.length}\n\n` +
      `Messages: ${entry.stats.messageCount}`
    );
    item.contextValue = "session";
    item.iconPath = entry.status === "active"
      ? new vscode.ThemeIcon("record", new vscode.ThemeColor("testing.runAction"))
      : new vscode.ThemeIcon("history");

    return item;
  }

  private createDetailItem(detail: SessionDetailNode): vscode.TreeItem {
    const item = new vscode.TreeItem(detail.label, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon(detail.icon);
    item.contextValue = "sessionDetail";
    return item;
  }

  dispose(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    this._onDidChangeTreeData.dispose();
  }
}
