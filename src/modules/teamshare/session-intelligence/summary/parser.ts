import * as fs from "fs";
import * as readline from "readline";
import type {
  RawJsonlMessage,
  ParsedToolCall,
  SessionParseResult,
  ToolUseContent,
} from "../types";

// ─── JSONL Parser ──────────────────────────────────────────────────
// Streams .jsonl files line by line (memory efficient).
// Extracts structured data: files, commands, tool calls, messages.

export async function parseSessionFile(filePath: string): Promise<SessionParseResult> {
  const result: SessionParseResult = {
    sessionId: "",
    firstUserMessage: "",
    messageCount: 0,
    toolCalls: [],
    filesEdited: new Map(),
    bashCommands: [],
    gitBranch: null,
    startedAt: "",
    lastTimestamp: "",
    userMessages: [],
  };

  const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }

    let msg: RawJsonlMessage;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }

    // Skip file-history-snapshot entries
    if (msg.type === "file-history-snapshot") {
      continue;
    }

    // Skip sidechain (subagent) messages
    if (msg.isSidechain) {
      continue;
    }

    // Track metadata
    if (msg.sessionId && !result.sessionId) {
      result.sessionId = msg.sessionId;
    }
    if (msg.gitBranch && !result.gitBranch) {
      result.gitBranch = msg.gitBranch;
    }
    if (msg.timestamp) {
      if (!result.startedAt) {
        result.startedAt = msg.timestamp;
      }
      result.lastTimestamp = msg.timestamp;
    }

    if (!msg.message) {
      continue;
    }

    result.messageCount++;

    // Extract user messages
    if (msg.message.role === "user" && typeof msg.message.content === "string") {
      const content = msg.message.content;
      // Skip meta/system messages
      if (!content.startsWith("<") && content.trim().length > 0) {
        if (!result.firstUserMessage) {
          result.firstUserMessage = content.slice(0, 200);
        }
        result.userMessages.push(content);
      }
    }

    // Extract tool calls from assistant messages
    if (msg.message.role === "assistant" && Array.isArray(msg.message.content)) {
      for (const block of msg.message.content as ToolUseContent[]) {
        if (block.type === "tool_use" && block.name && block.input) {
          const toolCall: ParsedToolCall = {
            tool: block.name,
            input: block.input as Record<string, unknown>,
            timestamp: msg.timestamp,
          };
          result.toolCalls.push(toolCall);
          processToolCall(toolCall, result);
        }
      }
    }
  }

  return result;
}

function processToolCall(call: ParsedToolCall, result: SessionParseResult): void {
  switch (call.tool) {
    case "Edit":
    case "MultiEdit": {
      const filePath = call.input["file_path"] as string | undefined;
      if (filePath) {
        trackFile(result, filePath, "modified");
      }
      break;
    }
    case "Write": {
      const filePath = call.input["file_path"] as string | undefined;
      if (filePath) {
        const existing = result.filesEdited.get(filePath);
        trackFile(result, filePath, existing ? "modified" : "created");
      }
      break;
    }
    case "Bash": {
      const command = call.input["command"] as string | undefined;
      if (command) {
        result.bashCommands.push(command);
      }
      break;
    }
  }
}

function trackFile(
  result: SessionParseResult,
  filePath: string,
  operation: "created" | "modified" | "deleted"
): void {
  const existing = result.filesEdited.get(filePath);
  if (existing) {
    existing.count++;
    // Don't downgrade "created" to "modified"
    if (existing.operation !== "created") {
      existing.operation = operation;
    }
  } else {
    result.filesEdited.set(filePath, { operation, count: 1 });
  }
}

// ─── Extract Keywords from Messages ────────────────────────────────
// Frequency-based keyword extraction. No AI needed.

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "must", "ought",
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her",
  "us", "them", "my", "your", "his", "its", "our", "their", "this",
  "that", "these", "those", "and", "but", "or", "nor", "not", "so",
  "if", "then", "than", "too", "very", "just", "about", "above",
  "after", "again", "all", "also", "am", "any", "because", "before",
  "between", "both", "by", "came", "come", "each", "for", "from",
  "get", "got", "had", "how", "in", "into", "its", "let", "like",
  "make", "many", "more", "most", "much", "no", "now", "of", "on",
  "only", "or", "other", "out", "over", "said", "same", "see",
  "some", "still", "such", "take", "tell", "to", "up", "use",
  "want", "way", "what", "when", "which", "who", "why", "with",
  // Vietnamese stop words
  "là", "và", "của", "có", "được", "cho", "không", "này", "đã",
  "với", "các", "một", "để", "từ", "trong", "ra", "về", "lại",
  "thì", "cũng", "như", "hay", "nhưng", "mà", "đó", "nào",
  // Code-related noise
  "import", "export", "const", "let", "var", "function", "return",
  "true", "false", "null", "undefined", "new", "class", "type",
  "file", "code", "line", "error", "ok", "yes", "no",
]);

export function extractKeywords(messages: string[], topN = 20): string[] {
  const freq = new Map<string, number>();

  for (const msg of messages) {
    const words = msg
      .toLowerCase()
      .replace(/[^a-zA-Z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

    for (const word of words) {
      freq.set(word, (freq.get(word) ?? 0) + 1);
    }
  }

  return Array.from(freq.entries())
    .filter(([, count]) => count >= 2) // Appears at least twice
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word);
}

// ─── Extract Git Info from Bash Commands ───────────────────────────

export function extractGitCommits(bashCommands: string[]): string[] {
  const commits: string[] = [];
  for (const cmd of bashCommands) {
    const match = cmd.match(/git commit.*-m\s+["'](.+?)["']/);
    if (match) {
      commits.push(match[1]);
    }
  }
  return commits;
}

export function extractNpmInstalls(bashCommands: string[]): string[] {
  const packages: string[] = [];
  for (const cmd of bashCommands) {
    const match = cmd.match(/npm install\s+(.+?)(?:\s|$)/);
    if (match) {
      packages.push(...match[1].split(/\s+/).filter((p) => !p.startsWith("-")));
    }
  }
  return packages;
}
