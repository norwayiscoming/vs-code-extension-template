---
description: Show who is actively working and what they're doing
allowed-tools: Bash, Read
---

# /teamshare:who

Show all active and recent sessions in this project.

## How to execute

1. Read the session registry:
   ```
   Read .teamshare/sessions/registry.json
   ```

2. If registry doesn't exist, tell the user:
   "No sessions tracked yet. Run /teamshare:index to scan existing sessions."

3. Separate sessions into groups:
   - **Active**: status = "active" AND last heartbeat < 2 minutes ago
   - **Recent** (today): status = "completed" AND startedAt is today
   - **Stale**: status = "active" BUT heartbeat > 2 minutes (mark as stale)

4. For stale sessions, update their status to "stale" in registry.

5. Present in this format:
   ```
   👥 TeamShare Status

   🟢 Active now:
     Brian (backend-lead) - "JWT Auth Middleware"
       Branch: feature/auth | Files: src/auth/middleware.ts +2
       Focus: Implementing rate limiting with Redis

     Anh (fullstack) - "User CRUD API"
       Branch: feature/api | Files: src/api/routes.ts
       Focus: Writing validation middleware

   ⚪ Completed today:
     Brian - "Database Migration v2" (finished 2h ago)
       Files: 3 modified | Duration: 45m

   📊 Summary: 2 active, 1 completed today, 12 this week
   ```

6. If there are file overlaps between active sessions, warn:
   ```
   ⚠️ Potential conflict: Brian and Anh both editing src/routes/index.ts
   ```
