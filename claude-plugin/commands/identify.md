---
description: Set your identity for the teamshare system (name, role)
argument-hint: <name> [role]
allowed-tools: Bash, Read, Write
---

# /teamshare:identify

Set your user identity so other team members can see who you are.

## How to execute

1. Parse arguments from $ARGUMENTS:
   - $1 = user name (required)
   - $2 = role (optional, e.g. "backend-lead", "fullstack", "frontend")

2. If no arguments provided, ask:
   - "What's your name?" (used to identify you in teamshare)
   - "What's your role? (optional, e.g. backend-lead, fullstack)"

3. Read current config if exists:
   ```
   Read .teamshare/config.json
   ```

4. Detect machine name from hostname.

5. Write config:
   ```json
   {
     "user": "<name>",
     "role": "<role or null>",
     "machine": "<hostname>"
   }
   ```
   to `.teamshare/config.json`

6. Confirm:
   ```
   ✅ Identity set:
     Name: Brian
     Role: backend-lead
     Machine: brian-macbook

   Other team members will see you as "Brian (backend-lead)" in /teamshare:who
   ```
