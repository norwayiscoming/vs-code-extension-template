---
description: Force rebuild all session indices from scratch
allowed-tools: Bash, Read, Write, Glob
---

# /teamshare:reindex

Force rebuild all search indices. Useful when summaries were manually edited or data seems stale.

## How to execute

1. Delete existing indices:
   ```bash
   rm -f .teamshare/search/keyword-index.json .teamshare/search/file-index.json
   ```

2. Read the registry:
   ```
   Read .teamshare/sessions/registry.json
   ```

3. For each session in registry:
   - Read its summary file
   - Rebuild keyword index entries (tags + title words + user name)
   - Rebuild file index entries

4. Save new indices

5. Report:
   ```
   🔄 Rebuilt indices for N sessions
   Keywords: X unique keywords
   Files: Y unique file paths
   ```
