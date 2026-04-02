---
description: Scan and index Claude Code sessions from ~/.claude/ for this project
allowed-tools: Bash, Read, Write, Glob
---

# /teamshare:index

Scan Claude Code session files and build the search index.

## How to execute

1. Determine the current project path and encode it:
   - Get current working directory
   - Replace `/` with `-` and remove leading `-` to match Claude's encoding
   - Example: `/Users/brian/agi/teamshare` → `-Users-brian-agi-teamshare`

2. Find all session files:
   ```bash
   ls ~/.claude/projects/{encoded-path}/*.jsonl 2>/dev/null
   ```

3. If no sessions found, tell user:
   "No Claude Code sessions found for this project at ~/.claude/projects/{encoded-path}/"

4. Ensure .teamshare directory structure exists:
   ```bash
   mkdir -p .teamshare/sessions/summaries .teamshare/sessions/vectors .teamshare/search
   ```

5. Ensure .teamshare/ is in .gitignore:
   ```bash
   grep -q ".teamshare" .gitignore 2>/dev/null || echo ".teamshare/" >> .gitignore
   ```

6. Read existing registry to avoid re-indexing:
   ```
   Read .teamshare/sessions/registry.json
   ```

7. For each session .jsonl file not already in registry:
   a. Read the file and parse JSONL lines
   b. Skip lines with `type: "file-history-snapshot"` and `isSidechain: true`
   c. Extract:
      - sessionId (from message.sessionId field)
      - First meaningful user message (skip messages starting with `<`)
      - All Edit/Write tool calls → file paths
      - All Bash commands (from tool_use with name "Bash")
      - Git branch (from gitBranch field)
      - Timestamps (first and last)
      - Message count
   d. Generate summary:
      - Title: first user message (truncated to 80 chars)
      - Tags: top keywords from user messages (frequency-based)
      - Files: list of files from Edit/Write tool calls
      - Actions: list from tool calls (Created X, Modified Y, Committed Z)
   e. Resolve identity from .teamshare/config.json or git config user.name
   f. Write summary to `.teamshare/sessions/summaries/{sessionId}.json`
   g. Add entry to registry

8. Build search indices:
   - Keyword index: for each session, index tags + title words + user name
   - File index: for each session, index file paths
   - Write to `.teamshare/search/keyword-index.json` and `.teamshare/search/file-index.json`

9. Save updated registry to `.teamshare/sessions/registry.json`

10. Report results:
    ```
    📋 Indexed N sessions (M new, K already indexed):

    New sessions indexed:
      - "JWT Auth Middleware" by Brian (120 messages, 5 files)
      - "API Endpoints Setup" by Anh (85 messages, 3 files)

    Total: X sessions, Y unique files, Z keywords indexed
    ```

## Notes
- Large session files (>5MB) may take a few seconds to parse
- Only parses main session, skips subagent transcripts
- Re-running /teamshare:index is safe - skips already indexed sessions
- Use /teamshare:reindex to force full rebuild
