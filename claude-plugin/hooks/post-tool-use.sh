#!/bin/bash
# ─── TeamShare: Post Tool Use Hook ──────────────────────────────────
# Tracks file edits and bash commands for session summary.
# Runs on Edit, Write, MultiEdit, Bash tool calls.
# Fast path: only updates .teamshare files, no heavy processing.

set -euo pipefail

INPUT=$(cat)
TEAMSHARE_DIR=".teamshare"
REGISTRY="$TEAMSHARE_DIR/sessions/registry.json"

# Quick exit if no registry
[ -f "$REGISTRY" ] || exit 0

SESSION_ID="${CLAUDE_SESSION_ID:-}"
[ -n "$SESSION_ID" ] || exit 0

# Extract tool info
TOOL_NAME=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_name',''))" 2>/dev/null || echo "")
[ -n "$TOOL_NAME" ] || exit 0

# Update registry with new file/command info
python3 << PYEOF
import json, sys, os

try:
    input_data = json.loads('''$INPUT''')
except:
    try:
        input_data = json.loads(sys.stdin.read()) if not '''$INPUT''' else {}
    except:
        input_data = {}

registry_path = "$REGISTRY"
session_id = "$SESSION_ID"
tool_name = "$TOOL_NAME"

try:
    with open(registry_path) as f:
        registry = json.load(f)
except:
    sys.exit(0)

session = registry.get("sessions", {}).get(session_id)
if not session:
    sys.exit(0)

changed = False
tool_input = input_data.get("tool_input", {})

# Track files from Edit/Write/MultiEdit
if tool_name in ("Edit", "Write", "MultiEdit"):
    file_path = tool_input.get("file_path", "")
    if file_path and file_path not in session["files"]:
        session["files"].append(file_path)
        changed = True
    session["stats"]["toolCalls"] = session["stats"].get("toolCalls", 0) + 1
    if tool_name == "Write" and file_path not in session.get("_seen_files", []):
        session["stats"]["filesCreated"] = session["stats"].get("filesCreated", 0) + 1
        session.setdefault("_seen_files", []).append(file_path)
    else:
        session["stats"]["filesModified"] = session["stats"].get("filesModified", 0) + 1
    changed = True

# Track bash commands (for git commits, npm installs, etc.)
if tool_name == "Bash":
    command = tool_input.get("command", "")
    session["stats"]["toolCalls"] = session["stats"].get("toolCalls", 0) + 1
    changed = True

    # Update title from first meaningful command context
    if session.get("title") == "Session starting..." and command:
        if command.startswith("git commit"):
            import re
            m = re.search(r'-m\s+["\'](.+?)["\']', command)
            if m:
                session["title"] = m.group(1)[:80]

# Update message count estimate
session["stats"]["messageCount"] = session["stats"].get("messageCount", 0) + 1

# Heartbeat
from datetime import datetime, timezone
session["lastHeartbeat"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

if changed:
    with open(registry_path, "w") as f:
        json.dump(registry, f, indent=2, default=str)

PYEOF

exit 0
