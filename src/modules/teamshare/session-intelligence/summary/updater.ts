import * as fs from "fs";
import * as path from "path";
import type { SessionSummary, SummaryUpdateOp, SummarySection } from "../types";
import { TEAMSHARE_DIR, SUMMARIES_DIR } from "../types";

// ─── Summary Updater ───────────────────────────────────────────────
// Applies INSERT/ALTER/REWRITE operations to summary files.
// Minimal changes only - like editing code.

export class SummaryUpdater {
  private summaryCache = new Map<string, SessionSummary>();

  constructor(private readonly projectRoot: string) {}

  private getSummaryPath(sessionId: string): string {
    return path.join(this.projectRoot, TEAMSHARE_DIR, SUMMARIES_DIR, `${sessionId}.json`);
  }

  load(sessionId: string): SessionSummary | null {
    const cached = this.summaryCache.get(sessionId);
    if (cached) {
      return cached;
    }

    const summaryPath = this.getSummaryPath(sessionId);
    try {
      const raw = fs.readFileSync(summaryPath, "utf-8");
      const summary = JSON.parse(raw) as SessionSummary;
      this.summaryCache.set(sessionId, summary);
      return summary;
    } catch {
      return null;
    }
  }

  save(sessionId: string, summary: SessionSummary): void {
    const summaryPath = this.getSummaryPath(sessionId);
    const dir = path.dirname(summaryPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf-8");
    this.summaryCache.set(sessionId, summary);
  }

  apply(sessionId: string, ops: SummaryUpdateOp[]): SessionSummary | null {
    const summary = this.load(sessionId);
    if (!summary) {
      return null;
    }

    for (const op of ops) {
      this.applyOp(summary, op);
    }

    summary.lastUpdated = new Date().toISOString();
    summary.updateCount++;

    this.save(sessionId, summary);
    return summary;
  }

  private applyOp(summary: SessionSummary, op: SummaryUpdateOp): void {
    switch (op.type) {
      case "insert":
        this.applyInsert(summary, op.section, op.line);
        break;
      case "alter":
        this.applyAlter(summary, op.section, op.match, op.replacement);
        break;
      case "rewrite":
        this.applyRewrite(summary, op.section, op.content);
        break;
    }
  }

  // ─── INSERT: Append new entry to a section ─────────────────────

  private applyInsert(summary: SessionSummary, section: SummarySection, line: string): void {
    switch (section) {
      case "actions":
        // Avoid duplicate actions
        if (!summary.actions.some((a) => a.description === line)) {
          summary.actions.push({
            timestamp: new Date().toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }),
            description: line,
            status: "done",
          });
        }
        break;
      case "decisions":
        if (!summary.decisions.includes(line)) {
          summary.decisions.push(line);
        }
        break;
      case "files": {
        if (!summary.files.some((f) => f.path === line)) {
          summary.files.push({ path: line, operation: "modified", modifyCount: 1 });
        } else {
          const existing = summary.files.find((f) => f.path === line);
          if (existing) {
            existing.modifyCount++;
          }
        }
        break;
      }
      case "openItems":
        if (!summary.openItems.includes(line)) {
          summary.openItems.push(line);
        }
        break;
      case "currentFocus":
        summary.currentFocus = line;
        break;
    }
  }

  // ─── ALTER: Modify existing entry (minimal change) ─────────────

  private applyAlter(
    summary: SessionSummary,
    section: SummarySection,
    match: string,
    replacement: string
  ): void {
    switch (section) {
      case "currentFocus":
        if (summary.currentFocus.includes(match)) {
          summary.currentFocus = replacement;
        }
        break;
      case "actions": {
        const action = summary.actions.find((a) => a.description.includes(match));
        if (action) {
          action.description = replacement;
        }
        break;
      }
      case "decisions": {
        const idx = summary.decisions.findIndex((d) => d.includes(match));
        if (idx >= 0) {
          summary.decisions[idx] = replacement;
        }
        break;
      }
      case "openItems": {
        const idx = summary.openItems.findIndex((item) => item.includes(match));
        if (idx >= 0) {
          summary.openItems[idx] = replacement;
        }
        break;
      }
      case "files":
        // File entries ALTER: update operation type
        break;
    }
  }

  // ─── REWRITE: Replace entire section (rare, AI-generated) ──────

  private applyRewrite(summary: SessionSummary, section: SummarySection, content: string): void {
    switch (section) {
      case "currentFocus":
        summary.currentFocus = content;
        break;
      case "decisions":
        summary.decisions = content.split("\n").filter((l) => l.trim());
        break;
      case "openItems":
        summary.openItems = content.split("\n").filter((l) => l.trim());
        break;
      case "actions":
      case "files":
        // Don't rewrite structured data - too risky
        break;
    }
  }

  // ─── Markdown Export ───────────────────────────────────────────

  toMarkdown(summary: SessionSummary): string {
    const lines: string[] = [];

    lines.push("## Current Focus");
    lines.push(summary.currentFocus);
    lines.push("");

    lines.push("## What was done");
    for (const action of summary.actions) {
      const marker = action.status === "in_progress" ? " <- IN PROGRESS" : "";
      lines.push(`- [${action.timestamp}] ${action.description}${marker}`);
    }
    lines.push("");

    if (summary.decisions.length > 0) {
      lines.push("## Key decisions");
      for (const decision of summary.decisions) {
        lines.push(`- ${decision}`);
      }
      lines.push("");
    }

    lines.push("## Files");
    for (const file of summary.files) {
      const countStr = file.modifyCount > 1 ? `, modified x${file.modifyCount}` : "";
      lines.push(`- \`${file.path}\` (${file.operation}${countStr})`);
    }
    lines.push("");

    if (summary.openItems.length > 0) {
      lines.push("## Open items");
      for (const item of summary.openItems) {
        lines.push(`- ${item}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  dispose(): void {
    this.summaryCache.clear();
  }
}
