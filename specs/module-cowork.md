# Module: TeamShare (Multi-Agent Coordination)

## Problem

Khi nhiều người cùng dùng Claude Code trên 1 repo:
- Không biết người khác đang làm gì → giẫm chân nhau
- Edit cùng file → git conflict
- Muốn giao tiếp qua session nhưng phải switch sang Slack/Discord
- Agent không biết context của người khác → đưa suggestion trùng lặp

## Goal

Coordination layer giữa các Claude Code sessions:
1. **Awareness**: Biết ai đang làm gì, sửa file nào
2. **Communication**: Gửi/nhận messages giữa sessions
3. **Conflict Prevention**: Alert trước khi edit file người khác đang sửa

## Architecture Decision: File-based vs Server

| | File-based | Server-based |
|---|---|---|
| Setup | Zero config | Cần deploy server |
| Latency | Polling (1-5s delay) | Real-time (WebSocket) |
| Scale | 2-5 người | 10+ người |
| Offline | Hoạt động | Không |
| Complexity | Thấp | Cao |

**Decision: File-based cho v1.** Lý do:
- Không cần infra
- Hoạt động trên cùng máy hoặc shared filesystem
- Đủ cho team nhỏ (2-5 người)
- Có thể migrate sang server-based sau

## Shared State Location

```
{project-root}/.teamshare/
  ├── agents.json           ← Registry: ai đang active
  ├── locks.json            ← File nào đang bị lock bởi ai
  ├── messages/             ← Message queue
  │   ├── {to-agent-id}/    ← Inbox của mỗi agent
  │   │   ├── {timestamp}-{from}.json
  │   │   └── ...
  │   └── broadcast/        ← Messages cho tất cả
  │       └── {timestamp}-{from}.json
  └── activity.jsonl        ← Activity log (append-only)
```

**Tại sao `.teamshare/` trong project root?**
- Tất cả members đều access được (git-ignored)
- Không phụ thuộc vào `~/.claude/` path
- Dễ debug (mở file ra xem)

**`.gitignore` phải thêm:**
```
.teamshare/
```

## Features

### F1: Agent Registry (Awareness)

Mỗi Claude Code session khi activate → register vào `.teamshare/agents.json`:

```json
{
  "agents": {
    "session-42a7f1c4": {
      "user": "Brian",
      "sessionId": "42a7f1c4-78b3-4805-82a3-125852156554",
      "pid": 12515,
      "startedAt": "2026-04-02T09:56:00Z",
      "lastHeartbeat": "2026-04-02T11:52:00Z",
      "status": "active",
      "currentTask": "Implementing auth middleware",
      "currentFiles": ["src/auth/middleware.ts", "src/auth/types.ts"]
    },
    "session-5dcd099b": {
      "user": "Anh",
      "sessionId": "5dcd099b-a8d5-4b0a-8aa0-20546458a2b8",
      "pid": 14200,
      "startedAt": "2026-04-02T10:25:00Z",
      "lastHeartbeat": "2026-04-02T11:55:00Z",
      "status": "active",
      "currentTask": "Building API endpoints",
      "currentFiles": ["src/api/routes.ts"]
    }
  }
}
```

**Cập nhật bằng cách nào:**
- `PostToolUse` hook trên Edit/Write → update `currentFiles`
- Heartbeat mỗi 30s → update `lastHeartbeat`
- Agent không heartbeat >2 phút → mark stale, remove sau 5 phút

**Hiển thị trong VS Code:**
- Status bar: `$(people) 2 agents active`
- Tree view trong sidebar:
  ```
  TeamShare Agents
    ├── 🟢 Brian - "Implementing auth middleware"
    │   └── src/auth/middleware.ts
    │   └── src/auth/types.ts
    └── 🟢 Anh - "Building API endpoints"
        └── src/api/routes.ts
  ```

### F2: File Lock (Conflict Prevention)

Khi agent bắt đầu edit file → acquire soft lock:

```json
{
  "locks": {
    "src/auth/middleware.ts": {
      "owner": "session-42a7f1c4",
      "user": "Brian",
      "since": "2026-04-02T11:30:00Z",
      "reason": "Implementing JWT validation"
    }
  }
}
```

**Pre-edit check flow:**
```
Agent muốn edit src/auth/middleware.ts
  → PreToolUse hook check locks.json
  → File đang locked bởi Brian
  → Hook return:
    {
      "decision": "block",
      "reason": "⚠️ File src/auth/middleware.ts đang được Brian sửa
                 (Implementing JWT validation) từ 11:30.
                 Đề xuất: Làm task khác trước, pull code sau khi Brian xong."
    }
```

**Lock lifecycle:**
- Acquire: Khi PreToolUse detect Edit/Write → auto lock
- Release: Khi session end, hoặc agent không edit file >5 phút
- Force release: User command `/teamshare:unlock <file>`
- Stale detection: Lock owner không heartbeat → auto release

### F3: Message Passing (Communication)

Message format:
```json
{
  "id": "msg-001",
  "from": { "sessionId": "session-5dcd099b", "user": "Anh" },
  "to": "session-42a7f1c4",
  "timestamp": "2026-04-02T11:45:00Z",
  "type": "text",
  "content": "Anh Brian ơi, em làm phần API routes nhé, anh focus auth"
}
```

**Delivery mechanism:**
- Sender ghi file vào `.teamshare/messages/{to-agent-id}/`
- Receiver poll inbox mỗi 5s qua `UserPromptSubmit` hook hoặc background timer
- Khi có message mới → inject vào context:
  ```
  📨 Message từ Anh (11:45):
  "Anh Brian ơi, em làm phần API routes nhé, anh focus auth"
  ```
- Đã đọc → move file sang `.teamshare/messages/{to-agent-id}/read/`

**Gửi message bằng cách nào:**
- Trong Claude session: "nhắn Brian là em làm phần A" → agent detect intent → ghi message file
- VS Code command palette: `TeamShare: Send Message`
- VS Code sidebar: click vào agent → chat input

**Cost control:**
- Message inject chỉ tốn ~50-100 tokens mỗi message
- Không inject cả conversation history, chỉ messages mới
- User có thể tắt message notification trong config

### F4: Activity Log

Append-only log cho audit trail:

```jsonl
{"ts":"2026-04-02T11:30:00Z","agent":"Brian","action":"edit_start","file":"src/auth/middleware.ts"}
{"ts":"2026-04-02T11:45:00Z","agent":"Anh","action":"message","to":"Brian","preview":"em làm phần API routes nhé"}
{"ts":"2026-04-02T11:50:00Z","agent":"Brian","action":"edit_done","file":"src/auth/middleware.ts","summary":"Added JWT validation"}
{"ts":"2026-04-02T11:51:00Z","agent":"Anh","action":"pull","files":["src/auth/middleware.ts"]}
```

Hiển thị trong sidebar dưới dạng timeline.

## Implementation Plan

### Phase 1: Awareness (hooks only, no VS Code UI)

```
src/modules/teamshare/
  ├── index.ts             ← TeamShareModule (ExtensionModule)
  ├── registry.ts          ← Agent registry (read/write agents.json)
  ├── types.ts             ← Agent, Lock, Message types
  └── hooks/
      ├── register.sh      ← SessionStart: register agent
      ├── heartbeat.sh     ← Periodic heartbeat (via PostToolUse)
      └── deregister.sh    ← Stop: deregister agent
```

Deliverable: agents.json được populate, stale detection works.

### Phase 2: Conflict Prevention (hooks + minimal UI)

```
  ├── locks.ts             ← Lock manager
  ├── hooks/
  │   └── pre-edit.sh      ← PreToolUse: check locks before Edit/Write
  └── status-bar.ts        ← Show active agents count
```

Deliverable: Agent bị block khi edit locked file, status bar shows count.

### Phase 3: Communication

```
  ├── messages.ts          ← Message queue (read/write)
  ├── hooks/
  │   └── check-inbox.sh   ← UserPromptSubmit: check for new messages
  ├── message-view.ts      ← Webview for chat-like message display
  └── commands.ts          ← Send message command
```

Deliverable: Send/receive messages between sessions.

### Phase 4: Full UI

```
  ├── teamshare-tree.ts       ← Tree view: agents + files + activity
  ├── activity-log.ts      ← Activity timeline in sidebar
  └── teamshare-panel.ts      ← Full webview panel with everything
```

## Edge Cases

### Stale agents
- Process crash → không deregister → heartbeat timeout → auto cleanup
- PID check: verify process still running via `kill -0 {pid}`

### File conflict despite lock
- Agent A locks file, Agent B force-edits → git handles conflict
- Lock là soft advisory, không physically prevent writes

### Large teams
- >5 agents: agents.json polling mỗi 5s × 5 agents = 25 reads/5s
- Solution: single watcher process hoặc migrate to server-based

### Cross-machine
- File-based chỉ work nếu shared filesystem (NFS, network drive)
- For remote teams: need server-based (Phase 5, future)

## Config

```json
{
  "teamshare.enabled": true,
  "teamshare.userName": "Brian",
  "teamshare.heartbeatInterval": 30000,
  "teamshare.messagePollingInterval": 5000,
  "teamshare.lockTimeout": 300000,
  "teamshare.staleAgentTimeout": 120000
}
```

## What This Is NOT

- **Không phải Live Share** - không real-time cursor sharing
- **Không phải git replacement** - vẫn cần branch/merge
- **Không phải chat app** - messages là lightweight notifications, không phải Slack
- **Không auto-merge code** - chỉ prevent conflicts, không resolve chúng
