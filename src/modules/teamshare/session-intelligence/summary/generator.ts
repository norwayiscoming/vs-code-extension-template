import * as path from "path";
import type {
  SessionSummary,
  SessionParseResult,
  SummaryAction,
  SummaryFileEntry,
} from "../types";
import { extractKeywords, extractGitCommits } from "./parser";

// ─── Summary Generator ─────────────────────────────────────────────
// Creates SessionSummary from parsed .jsonl data.
// Pure parse-based: 0 tokens cost.

export function generateSummary(parsed: SessionParseResult): SessionSummary {
  const actions = buildActions(parsed);
  const files = buildFileEntries(parsed);
  const decisions = extractDecisionsFromCommits(parsed);

  return {
    sessionId: parsed.sessionId,
    currentFocus: deriveCurrentFocus(parsed, actions),
    actions,
    decisions,
    files,
    openItems: [],
    lastUpdated: new Date().toISOString(),
    updateCount: 1,
  };
}

function buildActions(parsed: SessionParseResult): SummaryAction[] {
  const actions: SummaryAction[] = [];
  const seen = new Set<string>();

  for (const call of parsed.toolCalls) {
    let description = "";

    switch (call.tool) {
      case "Write": {
        const fp = call.input["file_path"] as string | undefined;
        if (fp) {
          const key = `write:${fp}`;
          if (!seen.has(key)) {
            seen.add(key);
            description = `Created ${path.basename(fp)}`;
          }
        }
        break;
      }
      case "Edit":
      case "MultiEdit": {
        const fp = call.input["file_path"] as string | undefined;
        if (fp) {
          const key = `edit:${fp}`;
          if (!seen.has(key)) {
            seen.add(key);
            description = `Modified ${path.basename(fp)}`;
          }
        }
        break;
      }
      case "Bash": {
        const cmd = call.input["command"] as string | undefined;
        if (cmd) {
          if (cmd.startsWith("git commit")) {
            const match = cmd.match(/-m\s+["'](.+?)["']/);
            description = match ? `Committed: ${match[1].slice(0, 80)}` : "Git commit";
          } else if (cmd.startsWith("npm install") || cmd.startsWith("npm i ")) {
            description = `Installed dependencies: ${cmd.slice(12).trim().slice(0, 60)}`;
          } else if (cmd.startsWith("npm test") || cmd.startsWith("npx jest") || cmd.startsWith("npx vitest")) {
            description = "Ran tests";
          } else if (cmd.startsWith("npm run build") || cmd.startsWith("npm run compile")) {
            description = "Built project";
          }
        }
        break;
      }
    }

    if (description) {
      const time = new Date(call.timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      actions.push({
        timestamp: time,
        description,
        status: "done",
      });
    }
  }

  return actions;
}

function buildFileEntries(parsed: SessionParseResult): SummaryFileEntry[] {
  return Array.from(parsed.filesEdited.entries()).map(([filePath, info]) => ({
    path: filePath,
    operation: info.operation,
    modifyCount: info.count,
  }));
}

function deriveCurrentFocus(parsed: SessionParseResult, actions: SummaryAction[]): string {
  // Use last action as current focus
  if (actions.length > 0) {
    return actions[actions.length - 1].description;
  }
  // Fallback to first user message
  if (parsed.firstUserMessage) {
    return parsed.firstUserMessage.slice(0, 100);
  }
  return "Starting session";
}

function extractDecisionsFromCommits(parsed: SessionParseResult): string[] {
  return extractGitCommits(parsed.bashCommands).slice(0, 10);
}

// ─── Generate Tags ─────────────────────────────────────────────────

export function generateTags(parsed: SessionParseResult): string[] {
  return extractKeywords(parsed.userMessages);
}

// ─── Generate Title ────────────────────────────────────────────────

export function generateTitle(parsed: SessionParseResult): string {
  // Priority 1: First meaningful user message
  if (parsed.firstUserMessage) {
    const cleaned = parsed.firstUserMessage
      .replace(/\n/g, " ")
      .trim()
      .slice(0, 80);
    if (cleaned.length > 10) {
      return cleaned;
    }
  }

  // Priority 2: Files + action
  if (parsed.filesEdited.size > 0) {
    const files = Array.from(parsed.filesEdited.keys())
      .map((f) => path.basename(f))
      .slice(0, 3);
    return `Edited ${files.join(", ")}`;
  }

  // Priority 3: Fallback
  return `Session ${parsed.sessionId.slice(0, 8)}`;
}

// ─── Duration String ───────────────────────────────────────────────

export function computeDuration(startedAt: string, endedAt: string): string {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  return `${hours}h ${remainMinutes}m`;
}
