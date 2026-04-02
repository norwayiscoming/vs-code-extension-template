// ─── Session Identity ──────────────────────────────────────────────

export interface UserIdentity {
  readonly user: string;
  readonly role?: string;
  readonly machine: string;
  readonly avatar?: string;
}

export interface SessionIdentity {
  readonly sessionId: string;
  readonly identity: UserIdentity;
  readonly branch: string;
  readonly project: string;
  readonly startedAt: string;
  endedAt: string | null;
  status: SessionStatus;
  title: string;
}

export type SessionStatus = "active" | "completed" | "stale";

// ─── Summary ───────────────────────────────────────────────────────

export interface SessionSummary {
  readonly sessionId: string;
  currentFocus: string;
  actions: SummaryAction[];
  decisions: string[];
  files: SummaryFileEntry[];
  openItems: string[];
  lastUpdated: string;
  updateCount: number;
}

export interface SummaryAction {
  readonly timestamp: string;
  description: string;
  status: "done" | "in_progress";
}

export interface SummaryFileEntry {
  readonly path: string;
  operation: "created" | "modified" | "deleted";
  modifyCount: number;
}

// ─── Summary Update Operations ─────────────────────────────────────

export type SummaryUpdateOp =
  | { type: "insert"; section: SummarySection; line: string }
  | { type: "alter"; section: SummarySection; match: string; replacement: string }
  | { type: "rewrite"; section: SummarySection; content: string };

export type SummarySection =
  | "currentFocus"
  | "actions"
  | "decisions"
  | "files"
  | "openItems";

// ─── JSONL Parsing ─────────────────────────────────────────────────

export interface RawJsonlMessage {
  uuid: string;
  parentUuid: string | null;
  type: "user" | "assistant" | "file-history-snapshot";
  isSidechain?: boolean;
  message?: {
    role: string;
    content: string | ToolUseContent[];
    model?: string;
  };
  timestamp: string;
  sessionId?: string;
  cwd?: string;
  version?: string;
  gitBranch?: string;
}

export interface ToolUseContent {
  type: "tool_use" | "tool_result" | "text";
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  text?: string;
  content?: string;
}

export interface ParsedToolCall {
  tool: string;
  input: Record<string, unknown>;
  timestamp: string;
}

export interface SessionParseResult {
  sessionId: string;
  firstUserMessage: string;
  messageCount: number;
  toolCalls: ParsedToolCall[];
  filesEdited: Map<string, { operation: "created" | "modified" | "deleted"; count: number }>;
  bashCommands: string[];
  gitBranch: string | null;
  startedAt: string;
  lastTimestamp: string;
  userMessages: string[];
}

// ─── Search ────────────────────────────────────────────────────────

export interface SearchQuery {
  text: string;
  filters?: SearchFilters;
}

export interface SearchFilters {
  user?: string;
  project?: string;
  branch?: string;
  dateFrom?: string;
  dateTo?: string;
  files?: string[];
  status?: SessionStatus;
}

export interface SearchResult {
  sessionId: string;
  identity: SessionIdentity;
  score: number;
  matchedIn: ("title" | "summary" | "tags" | "files")[];
  snippet: string;
}

// ─── Search Index ──────────────────────────────────────────────────

export interface KeywordIndex {
  version: number;
  keywords: Record<string, string[]>; // keyword → sessionIds
}

export interface FileIndex {
  version: number;
  files: Record<string, string[]>; // filePath → sessionIds
}

// ─── Session Registry ──────────────────────────────────────────────

export interface SessionRegistry {
  version: number;
  sessions: Record<string, SessionRegistryEntry>;
}

export interface SessionRegistryEntry {
  identity: UserIdentity;
  branch: string;
  project: string;
  startedAt: string;
  endedAt: string | null;
  status: SessionStatus;
  title: string;
  summaryFile: string;
  tags: string[];
  files: string[];
  stats: SessionStats;
}

export interface SessionStats {
  messageCount: number;
  toolCalls: number;
  filesCreated: number;
  filesModified: number;
  duration: string;
}

// ─── Embedding ─────────────────────────────────────────────────────

export interface EmbeddingConfig {
  provider: "openai" | "ollama" | "voyage" | "none";
  model: string;
  apiKey?: string;
  baseUrl?: string;
  dimensions: number;
}

export interface VectorStore {
  model: string;
  dimensions: number;
  vectors: Record<string, number[]>; // sessionId → vector
}

export interface EmbeddingProvider {
  readonly name: string;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

// ─── TeamShare Config ─────────────────────────────────────────────────

export interface TeamShareConfig {
  user: string;
  role?: string;
  avatar?: string;
  machine: string;
}

// ─── Constants ─────────────────────────────────────────────────────

export const TEAMSHARE_DIR = ".teamshare";
export const SESSIONS_DIR = "sessions";
export const SUMMARIES_DIR = "sessions/summaries";
export const VECTORS_DIR = "sessions/vectors";
export const SEARCH_DIR = "search";
export const REGISTRY_FILE = "sessions/registry.json";
export const CONFIG_FILE = "config.json";
export const KEYWORD_INDEX_FILE = "search/keyword-index.json";
export const FILE_INDEX_FILE = "search/file-index.json";
