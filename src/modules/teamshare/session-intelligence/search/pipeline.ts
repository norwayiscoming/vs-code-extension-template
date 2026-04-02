import * as fs from "fs";
import * as path from "path";
import type {
  SearchQuery,
  SearchResult,
  SessionRegistry,
  SessionRegistryEntry,
  SessionIdentity,
} from "../types";
import { TEAMSHARE_DIR, REGISTRY_FILE } from "../types";
import { applyStructuredFilter } from "./structured-filter";
import { keywordSearch } from "./keyword-search";
import { IndexBuilder } from "./index-builder";

// ─── Search Pipeline ───────────────────────────────────────────────
// 3-layer search: Structured → Keyword → Semantic (optional).
// Each layer narrows results progressively.

export class SearchPipeline {
  private readonly indexBuilder: IndexBuilder;

  constructor(private readonly projectRoot: string) {
    this.indexBuilder = new IndexBuilder(projectRoot);
  }

  search(query: SearchQuery): SearchResult[] {
    const registry = this.loadRegistry();
    if (!registry) {
      return [];
    }

    // Layer 1: Structured filter
    const filtered = query.filters
      ? applyStructuredFilter(registry.sessions, query.filters)
      : new Map(Object.entries(registry.sessions));

    if (filtered.size === 0) {
      return [];
    }

    // If no text query, return all filtered results
    if (!query.text.trim()) {
      return this.registryToResults(filtered);
    }

    // Layer 2: Keyword search
    const keywordResults = keywordSearch(
      query.text,
      filtered,
      this.indexBuilder,
      this.projectRoot
    );

    if (keywordResults.length > 0) {
      return keywordResults.map((kr) => {
        const entry = registry.sessions[kr.sessionId];
        return {
          sessionId: kr.sessionId,
          identity: this.entryToIdentity(kr.sessionId, entry),
          score: kr.score,
          matchedIn: this.detectMatchLocations(kr.matchedKeywords, entry),
          snippet: kr.snippet,
        };
      });
    }

    // Layer 3: Semantic search (TODO - embedding layer)
    // Falls through here when Layer 1+2 return 0 results
    // Will be implemented in embedding module

    return [];
  }

  // ─── Registry Management ─────────────────────────────────────

  loadRegistry(): SessionRegistry | null {
    const registryPath = path.join(this.projectRoot, TEAMSHARE_DIR, REGISTRY_FILE);
    try {
      const raw = fs.readFileSync(registryPath, "utf-8");
      return JSON.parse(raw) as SessionRegistry;
    } catch {
      return null;
    }
  }

  saveRegistry(registry: SessionRegistry): void {
    const registryPath = path.join(this.projectRoot, TEAMSHARE_DIR, REGISTRY_FILE);
    const dir = path.dirname(registryPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  }

  registerSession(sessionId: string, entry: SessionRegistryEntry): void {
    let registry = this.loadRegistry();
    if (!registry) {
      registry = { version: 1, sessions: {} };
    }
    registry.sessions[sessionId] = entry;
    this.saveRegistry(registry);

    // Update search indices
    this.indexBuilder.indexSession(sessionId, entry);
  }

  updateSessionStatus(
    sessionId: string,
    updates: Partial<Pick<SessionRegistryEntry, "status" | "endedAt" | "title" | "tags" | "files" | "stats">>
  ): void {
    const registry = this.loadRegistry();
    if (!registry || !registry.sessions[sessionId]) {
      return;
    }

    Object.assign(registry.sessions[sessionId], updates);
    this.saveRegistry(registry);

    // Re-index if tags or files changed
    if (updates.tags || updates.files) {
      this.indexBuilder.indexSession(sessionId, registry.sessions[sessionId]);
    }
  }

  rebuildIndices(): void {
    const registry = this.loadRegistry();
    if (registry) {
      this.indexBuilder.rebuild(registry.sessions);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private registryToResults(entries: Map<string, SessionRegistryEntry>): SearchResult[] {
    return Array.from(entries.entries())
      .map(([id, entry]) => ({
        sessionId: id,
        identity: this.entryToIdentity(id, entry),
        score: 1,
        matchedIn: ["title" as const],
        snippet: entry.title,
      }))
      .sort((a, b) => {
        // Sort by startedAt descending (most recent first)
        const aTime = entries.get(a.sessionId)?.startedAt ?? "";
        const bTime = entries.get(b.sessionId)?.startedAt ?? "";
        return bTime.localeCompare(aTime);
      });
  }

  private entryToIdentity(sessionId: string, entry: SessionRegistryEntry): SessionIdentity {
    return {
      sessionId,
      identity: entry.identity,
      branch: entry.branch,
      project: entry.project,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      status: entry.status,
      title: entry.title,
    };
  }

  private detectMatchLocations(
    matchedKeywords: string[],
    entry: SessionRegistryEntry
  ): ("title" | "summary" | "tags" | "files")[] {
    const locations = new Set<"title" | "summary" | "tags" | "files">();

    const titleLower = entry.title.toLowerCase();
    const tagsLower = entry.tags.map((t) => t.toLowerCase());
    const filesLower = entry.files.map((f) => f.toLowerCase());

    for (const kw of matchedKeywords) {
      if (titleLower.includes(kw)) {
        locations.add("title");
      }
      if (tagsLower.some((t) => t.includes(kw))) {
        locations.add("tags");
      }
      if (filesLower.some((f) => f.includes(kw))) {
        locations.add("files");
      }
    }

    if (locations.size === 0) {
      locations.add("summary");
    }

    return Array.from(locations);
  }
}
