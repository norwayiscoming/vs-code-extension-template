# Module: Session Intelligence

> Part of the TeamShare system. Provides session identity, summarization, search, and cross-session awareness for multi-user coordination at scale.

## Overview

Mỗi Claude Code session hiện tại là anonymous - chỉ có UUID, không có identity, không có summary, không searchable. Module này biến mỗi session thành một **identified, summarized, searchable unit** phục vụ cho multi-agent coordination.

## Core Concepts

### Session Identity

Mỗi session được định danh đầy đủ:

```json
{
  "sessionId": "42a7f1c4-78b3-4805-82a3-125852156554",
  "identity": {
    "user": "Brian",
    "role": "backend-lead",
    "machine": "brian-macbook",
    "branch": "feature/auth-middleware",
    "project": "/Users/brian/agi/teamshare",
    "startedAt": "2026-04-02T09:56:00Z",
    "endedAt": null,
    "status": "active"
  },
  "title": "JWT Auth Middleware Implementation",
  "tags": {
    "auto": ["authentication", "jwt", "middleware", "redis", "rate-limiting"],
    "files": ["src/auth/middleware.ts", "src/auth/types.ts", "src/auth/redis.ts"],
    "commands": ["npm install jsonwebtoken", "git commit"],
    "manual": ["sprint-14", "auth-epic"]
  },
  "summary": "Implemented JWT-based authentication middleware with Redis session store. Added rate limiting (100 req/min per user). Created 3 new files, modified 2 existing.",
  "stats": {
    "messageCount": 120,
    "toolCalls": 45,
    "filesCreated": 3,
    "filesModified": 2,
    "tokensUsed": 85000,
    "duration": "1h 45m"
  }
}
```

### Identity Sources

Identity được resolve theo priority:

```
1. .teamshare/config.json      ← user name, role (set once per machine)
2. git config user.name     ← fallback name
3. OS username              ← last resort
4. Session metadata         ← branch, cwd, timestamp (auto)
```

Config file (mỗi user set 1 lần):
```json
{
  "user": "Brian",
  "role": "backend-lead",
  "avatar": "🧑‍💻",
  "machine": "brian-macbook"
}
```

### Session Title

Auto-generated từ conversation content:

```
Priority 1: Explicit - user nói "tôi đang làm auth middleware"
Priority 2: First meaningful user message (skip greetings, commands)
Priority 3: Files edited + action verbs ("Created auth middleware, modified routes")
Priority 4: Fallback: "{user} - {branch} - {timestamp}"
```

Title update khi session có thêm context (lazy refinement).

## Data Architecture

### Storage Layout

```
.teamshare/
  ├── config.json                    ← User identity config (per machine)
  ├── sessions/
  │   ├── registry.json              ← All session identities + metadata
  │   ├── summaries/
  │   │   ├── {sessionId}.md         ← Human-readable summary
  │   │   └── {sessionId}.meta.json  ← Structured metadata + tags
  │   └── vectors/                   ← Optional embedding cache
  │       ├── index.json             ← {sessionId: vector} pairs
  │       └── config.json            ← Embedding model config
  ├── search/
  │   ├── keyword-index.json         ← Inverted index: keyword → [sessionIds]
  │   └── file-index.json            ← Inverted index: filePath → [sessionIds]
  └── ...other teamshare modules...
```

### Registry Schema (sessions/registry.json)

```json
{
  "version": 1,
  "sessions": {
    "42a7f1c4": {
      "identity": { "user": "Brian", "role": "backend-lead", "machine": "brian-macbook" },
      "branch": "feature/auth-middleware",
      "project": "/Users/brian/agi/teamshare",
      "startedAt": "2026-04-02T09:56:00Z",
      "endedAt": "2026-04-02T11:41:00Z",
      "status": "completed",
      "title": "JWT Auth Middleware Implementation",
      "summaryFile": "summaries/42a7f1c4.md",
      "tags": ["authentication", "jwt", "middleware"],
      "files": ["src/auth/middleware.ts", "src/auth/types.ts"],
      "stats": { "messageCount": 120, "filesModified": 5 }
    },
    "5dcd099b": {
      "identity": { "user": "Anh", "role": "fullstack", "machine": "anh-mac-mini" },
      "branch": "feature/api-endpoints",
      "project": "/Users/anh/agi/teamshare",
      "startedAt": "2026-04-02T10:25:00Z",
      "endedAt": null,
      "status": "active",
      "title": "User CRUD API Endpoints",
      "summaryFile": "summaries/5dcd099b.md",
      "tags": ["api", "crud", "drizzle", "users"],
      "files": ["src/api/routes.ts", "src/api/users.ts"],
      "stats": { "messageCount": 85, "filesModified": 3 }
    }
  }
}
```

### Summary File (summaries/{sessionId}.md)

See full format in **Summary Structure** section under Summary Generation.
Summary is a living document with INSERT/ALTER/REWRITE operations - not static.

## Search Pipeline

### 3-Layer Search Architecture

```
Query: "authentication setup"
         │
         ▼
┌─────────────────────────┐
│  Layer 1: Structured    │  ← Instant, free
│  Filter by: user, time, │
│  branch, project, files │
│  Source: registry.json   │
└──────────┬──────────────┘
           │ Filtered set (e.g. 15 → 8 sessions)
           ▼
┌─────────────────────────┐
│  Layer 2: Keyword       │  ← Instant, free
│  Inverted index lookup  │
│  + grep summaries       │
│  Source: keyword-index   │
│  + summaries/*.md       │
└──────────┬──────────────┘
           │ Ranked results (e.g. 8 → 3 matches)
           ▼
┌─────────────────────────┐
│  Layer 3: Semantic      │  ← Optional, background
│  Cosine similarity      │
│  against summary vectors│
│  Source: vectors/        │
│  Fallback when L1+L2    │
│  return 0 results       │
└──────────┬──────────────┘
           │ Final ranked results
           ▼
      Search Results
```

### Inverted Keyword Index (search/keyword-index.json)

Built from summaries, updated incrementally:

```json
{
  "authentication": ["42a7f1c4", "91a1e067"],
  "jwt": ["42a7f1c4"],
  "database": ["5dcd099b", "6dec60dc"],
  "migration": ["6dec60dc"],
  "api": ["5dcd099b", "72bda7e4"],
  "redis": ["42a7f1c4", "5dcd099b"]
}
```

Lookup = O(1). Build = scan summaries once.

### File Index (search/file-index.json)

```json
{
  "src/auth/middleware.ts": ["42a7f1c4"],
  "src/api/routes.ts": ["5dcd099b", "72bda7e4"],
  "package.json": ["42a7f1c4", "5dcd099b", "6dec60dc"]
}
```

## Embedding Layer (Optional)

### When it activates
- User has configured an embedding provider
- Layer 1+2 return 0 results for a query
- Background indexing has completed

### Embedding Provider Options

```json
{
  "provider": "openai",
  "model": "text-embedding-3-small",
  "apiKey": "${env:OPENAI_API_KEY}",
  "dimensions": 256
}
```

Supported providers:
- `openai` - text-embedding-3-small (cheapest, good enough)
- `ollama` - nomic-embed-text (free, local, slower)
- `voyage` - voyage-3-lite (good multilingual)
- `none` - disable embedding layer (default)

### Background Indexing

```
FileSystemWatcher on .teamshare/sessions/summaries/
  → New/updated .md file detected
  → Queue for embedding
  → Background worker (setInterval, non-blocking):
      1. Read summary text
      2. Call embedding API
      3. Store vector in vectors/index.json
      4. Update vectors/config.json (last indexed timestamp)
  → Rate limited: max 5 calls/minute to avoid API throttle
  → Retry with exponential backoff on failure
```

### Vector Storage

Simple JSON file (sufficient for <1000 sessions):

```json
{
  "model": "text-embedding-3-small",
  "dimensions": 256,
  "vectors": {
    "42a7f1c4": [0.023, -0.041, 0.087, ...],
    "5dcd099b": [-0.012, 0.055, 0.033, ...]
  }
}
```

For scale (>1000 sessions): migrate to SQLite with vector extension.

### Cosine Similarity Search

```typescript
function search(query: string, vectors: Record<string, number[]>): SearchResult[] {
  const queryVector = await embed(query);
  return Object.entries(vectors)
    .map(([id, vec]) => ({ id, score: cosineSimilarity(queryVector, vec) }))
    .filter(r => r.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}
```

Pure math, no dependencies. ~1ms for 1000 vectors × 256 dimensions.

## Summary Generation

Summary là **living document** - thay đổi liên tục trong lúc session chạy.
Giống code: chỉ INSERT dòng mới hoặc ALTER dòng cần sửa, không rewrite toàn bộ.

### Summary Structure (sections)

```markdown
---
sessionId: 42a7f1c4
user: Brian
title: JWT Auth Middleware Implementation
branch: feature/auth-middleware
startedAt: 2026-04-02T09:56:00Z
status: active
lastUpdated: 2026-04-02T11:30:00Z
updateCount: 5
---

## Current Focus
Implementing rate limiting with Redis sliding window

## What was done
- [09:56] Set up JWT token validation middleware
- [10:15] Created Redis session store with 24h TTL
- [10:45] Added auth middleware to protected routes
- [11:10] Implementing rate limiting ← IN PROGRESS
- [11:30] Added sliding window algorithm for rate limit

## Key decisions
- Redis over in-memory store (multi-instance support)
- JWT contains userId + role only (no sensitive data)
- Sliding window > fixed window for rate limiting

## Files
- `src/auth/middleware.ts` (created, modified ×2)
- `src/auth/types.ts` (created)
- `src/auth/redis.ts` (created)
- `src/routes/index.ts` (modified)
- `package.json` (modified)

## Open items
- TODO: Refresh token rotation
- TODO: Unit tests for token validation
```

### Update Operations

Summary changes via **3 operations only**:

#### 1. INSERT - Append new line to a section

Trigger: New file edited, new decision made, new task started.

```diff
 ## What was done
  - [09:56] Set up JWT token validation middleware
  - [10:15] Created Redis session store with 24h TTL
+ - [10:45] Added auth middleware to protected routes
```

Cost: **0 tokens** (parse-based, extract from tool calls).

#### 2. ALTER - Modify existing line (minimal change)

Trigger: Status change (IN PROGRESS → done), file modified again.

```diff
 ## Current Focus
-- Implementing rate limiting with Redis sliding window
+- Testing rate limiting + writing unit tests

 ## What was done
-- [11:10] Implementing rate limiting ← IN PROGRESS
+- [11:10] Implemented rate limiting with sliding window ✓
```

Cost: **0 tokens** (parse-based, detect from tool calls + message patterns).

#### 3. REWRITE (rare) - Regenerate a section with AI

Trigger: Session end, or user requests `/teamshare:summarize`.

Only rewrites specific sections that benefit from AI synthesis:
- `## Key decisions` - AI consolidates scattered decisions into clean bullets
- `## Open items` - AI detects unresolved TODOs from conversation

Cost: **~300-500 tokens per section**, not per entire summary.

### Update Triggers

```
Event                           → Operation         → Section affected
─────────────────────────────────────────────────────────────────────
Edit/Write tool call            → INSERT file        → ## Files
                                → INSERT action       → ## What was done

Bash(git commit)                → INSERT action       → ## What was done
Bash(npm install X)             → INSERT dep          → ## Files (deps)

User says "let's do X instead"  → ALTER decision      → ## Key decisions
                                → ALTER current focus  → ## Current Focus

User says "now do Y"            → ALTER focus          → ## Current Focus
                                → INSERT action        → ## What was done

10 messages since last update   → Batch INSERT         → Multiple sections
with no tool calls (discussion)   (parse user messages
                                   for decisions/plans)

Session end (Stop event)        → REWRITE decisions    → ## Key decisions
                                → REWRITE open items   → ## Open items
                                → ALTER status          → frontmatter: completed

Session stale (no heartbeat)    → ALTER status          → frontmatter: stale
```

### What triggers NOTHING (save cost)

- User asks Claude a question → no summary change (just Q&A)
- Claude reads a file → no change (just exploration)
- Claude shows output → no change (informational)
- Repeated edits to same file → only first INSERT, no duplicates

### Parse-based Detection (0 tokens)

Most updates don't need AI. Extract from `.jsonl` events:

```typescript
// Detect from tool calls
if (message.type === "tool_use" && message.name === "Edit") {
  → INSERT into ## Files: file_path
  → INSERT into ## What was done: "Modified {file_path}"
}

if (message.type === "tool_use" && message.name === "Bash") {
  const cmd = message.input.command;
  if (cmd.startsWith("git commit")) → INSERT "Committed: {extractMessage(cmd)}"
  if (cmd.startsWith("npm install")) → INSERT dep into ## Files
  if (cmd.startsWith("npm test")) → INSERT "Ran tests"
}

// Detect focus change from user messages
if (message.role === "user" && containsDirective(message.content)) {
  → ALTER ## Current Focus
}
```

### AI-assisted Detection (costs tokens, rare)

Only for things parse can't detect:

```
Parse can't detect:
- "Let's use Redis instead of Memcached" → key decision (needs NLU)
- "Actually forget the rate limiting for now" → scope change
- "The bug was caused by..." → insight worth capturing

Solution: Batch these. Every 20 messages, if there are unparseable
user messages, send them to AI for classification:

Prompt (~200 tokens input):
  "Classify these user messages as: decision, scope_change, insight, or skip.
   Return only the non-skip ones with a 1-line summary."

Output (~100 tokens):
  [{"type": "decision", "summary": "Chose Redis over Memcached for caching"}]

→ INSERT classified items into appropriate sections.

Total: ~300 tokens per 20 messages = ~15 tokens/message amortized.
```

### Update Frequency Summary

```
Real-time (every tool call):     Parse-based INSERT/ALTER    → 0 tokens
Periodic (every 20 messages):    AI classify batch           → ~300 tokens  
Session end:                     AI REWRITE 2 sections       → ~500 tokens
On demand:                       User triggers full rewrite  → ~800 tokens

Typical session (100 messages):
  Real-time updates: ~30 INSERTs, ~5 ALTERs         → 0 tokens
  Periodic AI: 5 batches × 300                        → 1,500 tokens
  Session end: 1 × 500                                → 500 tokens
  Total:                                               → ~2,000 tokens
```

### Index Update on Summary Change

When summary changes → update search indices incrementally:

```
INSERT new line with keyword "redis"
  → keyword-index.json: add sessionId to "redis" entry
  → No re-index of other sessions

INSERT new file "src/auth/redis.ts"  
  → file-index.json: add sessionId to "src/auth/redis.ts" entry

ALTER (keyword unchanged)
  → No index update needed

ALTER (keyword changed, e.g. "memcached" → "redis")
  → keyword-index.json: remove from "memcached", add to "redis"
```

Incremental index update = O(1) per change. Never full re-index during normal operation.

## Scale Considerations

### Data growth

| Team size | Sessions/day | Summaries size | Index size | Vector size |
|-----------|-------------|----------------|------------|-------------|
| 5 | 15 | ~75KB | ~5KB | ~60KB |
| 20 | 60 | ~300KB | ~20KB | ~240KB |
| 50 | 150 | ~750KB | ~50KB | ~600KB |
| 100 | 300/day, ~6000/month | ~15MB/month | ~1MB | ~12MB |

All fits in memory up to ~1000 sessions. Beyond that:

### Scale tiers

**Tier 1 (1-20 users): File-based**
- JSON files in `.teamshare/`
- In-memory search
- FileSystemWatcher for updates

**Tier 2 (20-100 users): SQLite**
- Single `.teamshare/sessions.db` file
- FTS5 for full-text search
- Vector search via sqlite-vec extension
- Still file-based, no server needed

**Tier 3 (100+ users): Server-based**
- Central server with PostgreSQL + pgvector
- WebSocket for real-time updates
- API for search/registry
- `.teamshare/` becomes local cache

### Migration path
- Tier 1 → 2: Import JSON into SQLite (one-time script)
- Tier 2 → 3: SQLite → PostgreSQL migration + add server

## Module Architecture

```
src/modules/teamshare/session-intelligence/
  ├── index.ts                  ← SessionIntelligenceModule (ExtensionModule)
  ├── types.ts                  ← SessionIdentity, Summary, SearchResult, etc.
  │
  ├── identity/
  │   ├── resolver.ts           ← Resolve identity from config/git/OS
  │   ├── config.ts             ← Read/write .teamshare/config.json
  │   └── session-tracker.ts    ← Track current session, update registry
  │
  ├── summary/
  │   ├── generator.ts          ← Parse-based + AI summary generation
  │   ├── updater.ts            ← Periodic summary updates
  │   └── parser.ts             ← Extract tags/files/commands from .jsonl
  │
  ├── search/
  │   ├── pipeline.ts           ← 3-layer search orchestrator
  │   ├── structured-filter.ts  ← Layer 1: registry-based filtering
  │   ├── keyword-search.ts     ← Layer 2: inverted index + grep
  │   ├── semantic-search.ts    ← Layer 3: embedding-based search
  │   └── index-builder.ts      ← Build/update keyword + file indices
  │
  ├── embedding/
  │   ├── manager.ts            ← Background embedding orchestrator
  │   ├── providers/
  │   │   ├── base.ts           ← EmbeddingProvider interface
  │   │   ├── openai.ts         ← OpenAI text-embedding-3-small
  │   │   ├── ollama.ts         ← Local Ollama nomic-embed
  │   │   └── voyage.ts         ← Voyage AI
  │   ├── vector-store.ts       ← Read/write vector index
  │   └── worker.ts             ← Background indexing worker
  │
  └── views/
      ├── session-tree.ts       ← TreeDataProvider: browse sessions
      ├── session-viewer.ts     ← WebviewPanel: view session content
      ├── search-view.ts        ← Search UI in sidebar
      └── identity-setup.ts     ← First-time identity config wizard
```

## VS Code Integration

### Commands
- `teamshare.sessions.search` - Open search
- `teamshare.sessions.browse` - Open session browser
- `teamshare.sessions.viewCurrent` - View current session info
- `teamshare.sessions.identify` - Set/update user identity
- `teamshare.sessions.summarize` - Force summarize current session
- `teamshare.sessions.reindex` - Rebuild search indices

### Views
- **Session Browser** (tree view in sidebar)
  ```
  Active Sessions
    ├── 🟢 Brian - "JWT Auth Middleware" (feature/auth)
    │     └── src/auth/middleware.ts, src/auth/types.ts
    └── 🟢 Anh - "User CRUD API" (feature/api)
          └── src/api/routes.ts
  
  Recent Sessions (today)
    ├── ⚪ Brian - "Database Migration v2" (2h ago)
    └── ⚪ Anh - "Project Setup" (4h ago)
  
  This Week
    └── ⚪ Brian - "Initial Scaffold" (2 days ago)
  ```

- **Search Results** (webview in sidebar)
  ```
  🔍 "authentication"
  
  3 results:
  ┌─ Brian - "JWT Auth Middleware" (today) ────────┐
  │ Implemented JWT-based authentication           │
  │ middleware with Redis session store...          │
  │ Files: src/auth/middleware.ts +2                │
  │                        [View] [Copy Summary]   │
  └────────────────────────────────────────────────┘
  ```

- **Session Detail** (webview panel in editor)
  Full conversation view with filters, copy actions

### Status Bar
```
$(people) 2 active  |  $(search) Sessions: 47 indexed
```

## Configuration

```json
{
  "teamshare.sessionIntelligence.enabled": true,
  "teamshare.sessionIntelligence.summaryInterval": 20,
  "teamshare.sessionIntelligence.aiSummary": true,
  "teamshare.sessionIntelligence.embedding.provider": "none",
  "teamshare.sessionIntelligence.embedding.model": "text-embedding-3-small",
  "teamshare.sessionIntelligence.embedding.dimensions": 256,
  "teamshare.sessionIntelligence.embedding.backgroundIndex": true,
  "teamshare.sessionIntelligence.scale": "file"
}
```

## Milestones

### v0.1 - Identity + Parse-based Summary
- Identity resolver (config + git + OS fallback)
- Identity setup wizard
- Parse .jsonl → extract files, commands, keywords, stats
- Generate parse-based summary (0 token cost)
- Registry.json population
- Session browser tree view (active + recent)

### v0.2 - Search (Layer 1 + 2)
- Keyword index builder
- File index builder
- Structured filter (by user, time, branch, project)
- Keyword search across summaries
- Search UI in sidebar

### v0.3 - AI Summary
- AI summary at session end (~500 tokens)
- Running summary updates every 20 messages
- Summary viewer webview

### v0.4 - Embedding Layer (Optional)
- Embedding provider abstraction
- OpenAI + Ollama providers
- Background indexing worker
- Semantic search fallback (Layer 3)
- Vector store management

### v0.5 - Scale
- SQLite migration (Tier 2)
- FTS5 full-text search
- sqlite-vec for vector search
- Performance optimization for 100+ sessions

### v1.0 - Production
- Server-based option (Tier 3)
- WebSocket real-time updates
- Cross-machine support
- Dashboard / analytics
