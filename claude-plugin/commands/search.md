---
description: Search across all Claude Code sessions by keyword, user, file, or topic
argument-hint: <query> [--user <name>] [--branch <branch>] [--file <path>]
allowed-tools: Bash, Read, Glob, Grep
---

# /teamshare:search

Search across all indexed session summaries in this project.

## How to execute

1. Parse the arguments from $ARGUMENTS:
   - First positional arg = search query text
   - `--user <name>` = filter by user name
   - `--branch <branch>` = filter by git branch
   - `--file <path>` = filter by file path

2. Read the session registry:
   ```
   Read .teamshare/sessions/registry.json
   ```

3. If registry doesn't exist or is empty, tell the user:
   "No sessions indexed yet. Run /teamshare:index to scan existing sessions."

4. Apply filters from arguments:
   - If --user provided: filter sessions where identity.user matches
   - If --branch provided: filter sessions where branch matches
   - If --file provided: filter sessions where files array contains match

5. Search the filtered sessions:
   - Read the keyword index: `.teamshare/search/keyword-index.json`
   - Tokenize the query into keywords
   - Look up each keyword in the index
   - Score sessions by number of keyword matches
   - For top results, read their summary files from `.teamshare/sessions/summaries/{sessionId}.json`
   - Grep summary content for the query text

6. Present results in this format:
   ```
   🔍 Found N sessions matching "query":

   1. 🟢 Brian - "JWT Auth Middleware" (today, 11:42)
      Branch: feature/auth  |  Files: 5  |  Score: 8
      ...implemented JWT-based authentication middleware...
      Tags: authentication, jwt, middleware, redis

   2. ⚪ Anh - "API Endpoints Setup" (yesterday, 15:00)
      Branch: feature/api  |  Files: 3  |  Score: 4
      ...created user CRUD API endpoints...
      Tags: api, crud, drizzle
   ```

7. After showing results, ask:
   "Want to copy any session's summary to use as context? Reply with the number."

8. If user picks a number, read that session's summary and format as injectable context:
   ```
   [Context from session "JWT Auth Middleware" by Brian on 2 Apr]:
   - Implemented JWT-based authentication middleware
   - Added Redis session store with 24h TTL
   - Rate limiting: 100 req/min per user (sliding window)
   - Files: src/auth/middleware.ts, src/auth/types.ts, src/auth/redis.ts
   - Open items: refresh token rotation, unit tests
   ```
   Then say: "Context copied. You can paste this into any Claude session."
