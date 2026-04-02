#!/bin/bash
# ─── TeamShare: Session Start Hook ──────────────────────────────────
# Registers this session in .teamshare/sessions/registry.json
# Resolves identity from .teamshare/config.json or git config

set -euo pipefail

INPUT=$(cat)
TEAMSHARE_DIR=".teamshare"
REGISTRY="$TEAMSHARE_DIR/sessions/registry.json"

# Ensure dirs exist
mkdir -p "$TEAMSHARE_DIR/sessions/summaries" "$TEAMSHARE_DIR/sessions/vectors" "$TEAMSHARE_DIR/search"

# Ensure .teamshare in .gitignore
if [ -f .gitignore ]; then
  grep -q "^\.teamshare" .gitignore 2>/dev/null || echo ".teamshare/" >> .gitignore
else
  echo ".teamshare/" > .gitignore
fi

# Get session ID from environment
SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"
if [ "$SESSION_ID" = "unknown" ]; then
  # Try extracting from hook input
  SESSION_ID=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('session_id','unknown'))" 2>/dev/null || echo "unknown")
fi

# Resolve identity
if [ -f "$TEAMSHARE_DIR/config.json" ]; then
  USER_NAME=$(python3 -c "import json; d=json.load(open('$TEAMSHARE_DIR/config.json')); print(d.get('user',''))" 2>/dev/null || echo "")
  USER_ROLE=$(python3 -c "import json; d=json.load(open('$TEAMSHARE_DIR/config.json')); print(d.get('role',''))" 2>/dev/null || echo "")
fi

if [ -z "${USER_NAME:-}" ]; then
  USER_NAME=$(git config user.name 2>/dev/null || whoami)
fi

MACHINE=$(hostname)
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
PROJECT=$(pwd)
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Initialize registry if needed
if [ ! -f "$REGISTRY" ]; then
  echo '{"version":1,"sessions":{}}' > "$REGISTRY"
fi

# Register session using Python (safe JSON manipulation)
python3 << PYEOF
import json, os

registry_path = "$REGISTRY"
try:
    with open(registry_path) as f:
        registry = json.load(f)
except:
    registry = {"version": 1, "sessions": {}}

session_id = "$SESSION_ID"
if session_id and session_id != "unknown":
    registry["sessions"][session_id] = {
        "identity": {
            "user": "$USER_NAME",
            "role": "${USER_ROLE:-}" or None,
            "machine": "$MACHINE"
        },
        "branch": "$BRANCH",
        "project": "$PROJECT",
        "startedAt": "$NOW",
        "endedAt": None,
        "status": "active",
        "title": "Session starting...",
        "summaryFile": f"summaries/{session_id}.json",
        "tags": [],
        "files": [],
        "stats": {
            "messageCount": 0,
            "toolCalls": 0,
            "filesCreated": 0,
            "filesModified": 0,
            "duration": "0m"
        }
    }

    with open(registry_path, "w") as f:
        json.dump(registry, f, indent=2, default=str)

PYEOF

# Output context for Claude
cat << EOF
{
  "hookEventName": "SessionStart",
  "additionalContext": "TeamShare session intelligence active. User: $USER_NAME. Use /teamshare:who to see team activity, /teamshare:search to find across sessions."
}
EOF
