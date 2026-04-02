#!/bin/bash
# ─── TeamShare: Session Stop Hook ───────────────────────────────────
# Marks session as completed, generates final summary,
# updates search indices.

set -euo pipefail

INPUT=$(cat)
TEAMSHARE_DIR=".teamshare"
REGISTRY="$TEAMSHARE_DIR/sessions/registry.json"

[ -f "$REGISTRY" ] || exit 0

SESSION_ID="${CLAUDE_SESSION_ID:-}"
[ -n "$SESSION_ID" ] || exit 0

python3 << PYEOF
import json, os, re
from datetime import datetime, timezone
from collections import Counter

registry_path = "$REGISTRY"
session_id = "$SESSION_ID"
teamshare_dir = "$TEAMSHARE_DIR"

try:
    with open(registry_path) as f:
        registry = json.load(f)
except:
    exit(0)

session = registry.get("sessions", {}).get(session_id)
if not session:
    exit(0)

# ─── Mark completed ──────────────────────────────────────────
now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
session["status"] = "completed"
session["endedAt"] = now

# ─── Calculate duration ──────────────────────────────────────
try:
    start = datetime.fromisoformat(session["startedAt"].replace("Z", "+00:00"))
    end = datetime.fromisoformat(now.replace("Z", "+00:00"))
    minutes = int((end - start).total_seconds() / 60)
    if minutes < 60:
        session["stats"]["duration"] = f"{minutes}m"
    else:
        h, m = divmod(minutes, 60)
        session["stats"]["duration"] = f"{h}h {m}m"
except:
    pass

# ─── Generate tags from files ────────────────────────────────
tags = set()
for f in session.get("files", []):
    parts = f.replace("/", " ").replace(".", " ").replace("-", " ").replace("_", " ").split()
    for p in parts:
        if len(p) > 2 and p not in ("src", "dist", "out", "index", "test", "spec"):
            tags.add(p.lower())
session["tags"] = list(tags)[:20]

# ─── Generate parse-based summary ────────────────────────────
summary = {
    "sessionId": session_id,
    "currentFocus": session.get("title", "Completed"),
    "actions": [],
    "decisions": [],
    "files": [{"path": f, "operation": "modified", "modifyCount": 1} for f in session.get("files", [])],
    "openItems": [],
    "lastUpdated": now,
    "updateCount": 1
}

summary_path = os.path.join(teamshare_dir, "sessions", "summaries", f"{session_id}.json")
os.makedirs(os.path.dirname(summary_path), exist_ok=True)
with open(summary_path, "w") as f:
    json.dump(summary, f, indent=2)

# ─── Update keyword index ────────────────────────────────────
kw_index_path = os.path.join(teamshare_dir, "search", "keyword-index.json")
try:
    with open(kw_index_path) as f:
        kw_index = json.load(f)
except:
    kw_index = {"version": 1, "keywords": {}}

for tag in session.get("tags", []):
    kw_index["keywords"].setdefault(tag, [])
    if session_id not in kw_index["keywords"][tag]:
        kw_index["keywords"][tag].append(session_id)

# Index user name
user = session.get("identity", {}).get("user", "").lower()
if user:
    kw_index["keywords"].setdefault(user, [])
    if session_id not in kw_index["keywords"][user]:
        kw_index["keywords"][user].append(session_id)

with open(kw_index_path, "w") as f:
    json.dump(kw_index, f, indent=2)

# ─── Update file index ───────────────────────────────────────
file_index_path = os.path.join(teamshare_dir, "search", "file-index.json")
try:
    with open(file_index_path) as f:
        file_index = json.load(f)
except:
    file_index = {"version": 1, "files": {}}

for fp in session.get("files", []):
    file_index["files"].setdefault(fp, [])
    if session_id not in file_index["files"][fp]:
        file_index["files"][fp].append(session_id)

with open(file_index_path, "w") as f:
    json.dump(file_index, f, indent=2)

# ─── Save registry ───────────────────────────────────────────
# Clean up internal tracking fields
session.pop("_seen_files", None)
session.pop("lastHeartbeat", None)

with open(registry_path, "w") as f:
    json.dump(registry, f, indent=2, default=str)

PYEOF

exit 0
