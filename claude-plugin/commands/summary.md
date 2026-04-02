---
description: View or generate summary for a specific session
argument-hint: [session-id or search query]
allowed-tools: Bash, Read, Glob
---

# /teamshare:summary

View the summary of a session. If no argument, shows current session's summary.

## How to execute

1. Parse $ARGUMENTS:
   - If empty: show summary of the most recent active session
   - If looks like a UUID/session ID: show that specific session
   - Otherwise: treat as search query, find best match, show its summary

2. Read registry:
   ```
   Read .teamshare/sessions/registry.json
   ```

3. Find the target session:
   - If by ID: look up directly in registry
   - If by search: tokenize query, check keyword index, pick top match

4. Read the summary file:
   ```
   Read .teamshare/sessions/summaries/{sessionId}.json
   ```

5. Present as formatted markdown:
   ```
   📄 Session Summary: "JWT Auth Middleware"

   👤 Brian (backend-lead) | 🌿 feature/auth | 🕐 2 Apr 09:56 - 11:41

   ## Current Focus
   Implementing rate limiting with Redis sliding window

   ## What was done
   - [09:56] Set up JWT token validation middleware
   - [10:15] Created Redis session store with 24h TTL
   - [10:45] Added auth middleware to protected routes
   - [11:10] Implemented rate limiting with sliding window ✓

   ## Key decisions
   - Redis over in-memory (multi-instance support)
   - JWT contains userId + role only
   - Sliding window for rate limiting

   ## Files (5)
   - src/auth/middleware.ts (created, modified ×2)
   - src/auth/types.ts (created)
   - src/auth/redis.ts (created)
   - src/routes/index.ts (modified)
   - package.json (modified)

   ## Open items
   - Refresh token rotation
   - Unit tests for token validation

   📊 120 messages | 45 tool calls | Duration: 1h 45m
   ```

6. Offer actions:
   "Copy this summary as context for another session? (yes/no)"
