# Module: Session Search

## Problem

Mỗi Claude Code session là 1 file `.jsonl` tách biệt. Khi cần tìm lại thông tin từ sessions cũ (code đã viết, quyết định đã đưa ra, bug đã fix), user phải nhớ hoặc mở từng session. Điều này dẫn đến:

- User hỏi lại Claude cùng câu hỏi → tốn token
- User giải thích lại context đã có → tốn token
- User không tìm được session có thông tin cần thiết → mất thời gian

## Goal

Cho phép user search nội dung across tất cả sessions, tìm nhanh context cần thiết, và inject compact summary vào session hiện tại thay vì hỏi lại từ đầu.

## Token Savings

| Scenario | Không có search | Có search |
|----------|----------------|-----------|
| "Tôi đã config esbuild như nào tuần trước?" | Claude explore lại codebase ~5K tokens | Search → tìm session → copy snippet ~200 tokens |
| "Bug auth fix bằng cách nào?" | Giải thích lại vấn đề + Claude debug lại ~10K tokens | Search → tìm session có fix → inject summary ~500 tokens |
| "Anh Brian setup database schema ra sao?" | Không biết, phải hỏi Brian hoặc đoán ~3K tokens | Search sessions của Brian → lấy summary ~300 tokens |

## Data Source

```
~/.claude/projects/{encoded-path}/{sessionId}.jsonl
```

Mỗi dòng JSONL:
```json
{
  "uuid": "...",
  "parentUuid": "...",
  "type": "user" | "assistant",
  "message": { "role": "...", "content": "..." },
  "timestamp": "...",
  "sessionId": "...",
  "cwd": "...",
  "version": "..."
}
```

Cũng có type `"file-history-snapshot"` → skip khi search.

Subagents nằm trong:
```
~/.claude/projects/{encoded-path}/{sessionId}/subagents/agent-{id}.jsonl
~/.claude/projects/{encoded-path}/{sessionId}/subagents/agent-{id}.meta.json
```

## Features

### F1: Full-text Search
- Input: keyword/phrase
- Scope: tất cả `.jsonl` trong 1 project hoặc all projects
- Output: list of matches với:
  - Session ID + timestamp + project
  - Message snippet (±3 messages xung quanh match)
  - Match highlight

### F2: Session Browser
- Tree view trong sidebar hiển thị:
  ```
  Projects/
    ├── agi/teamshare/ (3 sessions)
    │   ├── 2 Apr 11:42 - "VS Code template" (330 messages)
    │   ├── 1 Apr 15:20 - "ACP worker setup" (120 messages)
    │   └── 31 Mar 09:50 - "Database migration" (85 messages)
    └── agi/acp/ (5 sessions)
        └── ...
  ```
- Session label = first user message hoặc AI-generated summary
- Click → xem full session trong webview panel

### F3: Session Viewer
- Webview panel hiển thị conversation dạng chat
- Render markdown content
- Collapse tool calls (chỉ hiện kết quả)
- Filter: chỉ user messages, chỉ assistant, chỉ code blocks

### F4: Snippet Copy
- User chọn 1 hoặc nhiều messages từ session viewer
- "Copy as Summary" → compact version để paste vào session hiện tại
- "Copy as Context" → formatted cho Claude hiểu
- Format output:
  ```
  [From session "VS Code template" on 2 Apr]:
  - Built modular extension with ExtensionModule system
  - Used esbuild for bundling, not webpack
  - Tree view uses BaseTreeDataProvider with refresh()
  ```

### F5: Search Index (optimization)
- Build lightweight index khi extension activate
- Index = {sessionId, firstMessage, timestamp, project, messageCount, keywords}
- Update index incrementally khi new sessions detected
- Store in extension's globalState hoặc file riêng
- Avoid re-reading full `.jsonl` files mỗi lần search

## Architecture

```
src/modules/session-search/
  ├── index.ts              ← SessionSearchModule (ExtensionModule)
  ├── parser.ts             ← Parse .jsonl files, extract messages
  ├── indexer.ts            ← Build/update search index
  ├── searcher.ts           ← Full-text search engine
  ├── session-tree.ts       ← TreeDataProvider for session browser
  ├── session-viewer.ts     ← WebviewPanel for viewing sessions
  └── types.ts              ← Session, Message, SearchResult types
```

## UI Placement

- **Activity Bar**: Icon cho session search (reuse sidebar container)
- **Tree View**: Session browser (grouped by project)
- **Search Box**: Quick input at top of tree view
- **Webview Panel**: Session viewer (opens in editor area)
- **Context Menu**: "Copy as Summary" / "Copy as Context"

## Performance Concerns

- Một project có thể có 50+ sessions, mỗi session 1-5MB
- KHÔNG đọc tất cả files upfront. Lazy load.
- Search bằng streaming read (readline), không load full file vào memory
- Index file nhỏ (~1KB per session) cho fast browsing
- Full-text search chỉ khi user trigger, không background

## Privacy

- Tất cả data ở local (`~/.claude/`), không gửi đi đâu
- Extension chỉ READ, không WRITE vào `.claude/` sessions
- Không index sensitive content (chỉ metadata + keywords)

## Dependencies

- Không cần dependency ngoài. Dùng Node.js built-in `readline` + `fs`.
- Optional: `fuse.js` cho fuzzy search (~10KB)

## Milestones

1. **v0.1**: Session browser (tree view) + session viewer (webview)
2. **v0.2**: Full-text search
3. **v0.3**: Snippet copy + summary format
4. **v0.4**: Search index + performance optimization
