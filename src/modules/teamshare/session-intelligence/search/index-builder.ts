import * as fs from "fs";
import * as path from "path";
import type { KeywordIndex, FileIndex, SessionRegistryEntry } from "../types";
import { TEAMSHARE_DIR, KEYWORD_INDEX_FILE, FILE_INDEX_FILE } from "../types";

// ─── Index Builder ─────────────────────────────────────────────────
// Builds and incrementally updates inverted indices for search.

export class IndexBuilder {
  private keywordIndex: KeywordIndex = { version: 1, keywords: {} };
  private fileIndex: FileIndex = { version: 1, files: {} };

  constructor(private readonly projectRoot: string) {
    this.loadIndices();
  }

  private getKeywordIndexPath(): string {
    return path.join(this.projectRoot, TEAMSHARE_DIR, KEYWORD_INDEX_FILE);
  }

  private getFileIndexPath(): string {
    return path.join(this.projectRoot, TEAMSHARE_DIR, FILE_INDEX_FILE);
  }

  // ─── Load existing indices ─────────────────────────────────────

  private loadIndices(): void {
    try {
      const raw = fs.readFileSync(this.getKeywordIndexPath(), "utf-8");
      this.keywordIndex = JSON.parse(raw);
    } catch {
      // Start fresh
    }

    try {
      const raw = fs.readFileSync(this.getFileIndexPath(), "utf-8");
      this.fileIndex = JSON.parse(raw);
    } catch {
      // Start fresh
    }
  }

  // ─── Save indices ──────────────────────────────────────────────

  private saveIndices(): void {
    const keywordPath = this.getKeywordIndexPath();
    const filePath = this.getFileIndexPath();

    fs.mkdirSync(path.dirname(keywordPath), { recursive: true });
    fs.writeFileSync(keywordPath, JSON.stringify(this.keywordIndex, null, 2));
    fs.writeFileSync(filePath, JSON.stringify(this.fileIndex, null, 2));
  }

  // ─── Incremental Update ────────────────────────────────────────
  // Call when a session's summary changes. Only updates affected entries.

  indexSession(sessionId: string, entry: SessionRegistryEntry): void {
    // Remove old entries for this session (in case of re-index)
    this.removeSession(sessionId);

    // Index keywords (tags)
    for (const tag of entry.tags) {
      const key = tag.toLowerCase();
      if (!this.keywordIndex.keywords[key]) {
        this.keywordIndex.keywords[key] = [];
      }
      if (!this.keywordIndex.keywords[key].includes(sessionId)) {
        this.keywordIndex.keywords[key].push(sessionId);
      }
    }

    // Index title words
    const titleWords = entry.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    for (const word of titleWords) {
      if (!this.keywordIndex.keywords[word]) {
        this.keywordIndex.keywords[word] = [];
      }
      if (!this.keywordIndex.keywords[word].includes(sessionId)) {
        this.keywordIndex.keywords[word].push(sessionId);
      }
    }

    // Index user name
    const userName = entry.identity.user.toLowerCase();
    if (!this.keywordIndex.keywords[userName]) {
      this.keywordIndex.keywords[userName] = [];
    }
    if (!this.keywordIndex.keywords[userName].includes(sessionId)) {
      this.keywordIndex.keywords[userName].push(sessionId);
    }

    // Index files
    for (const file of entry.files) {
      if (!this.fileIndex.files[file]) {
        this.fileIndex.files[file] = [];
      }
      if (!this.fileIndex.files[file].includes(sessionId)) {
        this.fileIndex.files[file].push(sessionId);
      }
    }

    this.saveIndices();
  }

  // ─── Remove session from indices ───────────────────────────────

  removeSession(sessionId: string): void {
    for (const [keyword, ids] of Object.entries(this.keywordIndex.keywords)) {
      this.keywordIndex.keywords[keyword] = ids.filter((id) => id !== sessionId);
      if (this.keywordIndex.keywords[keyword].length === 0) {
        delete this.keywordIndex.keywords[keyword];
      }
    }

    for (const [file, ids] of Object.entries(this.fileIndex.files)) {
      this.fileIndex.files[file] = ids.filter((id) => id !== sessionId);
      if (this.fileIndex.files[file].length === 0) {
        delete this.fileIndex.files[file];
      }
    }
  }

  // ─── Query indices ─────────────────────────────────────────────

  lookupKeyword(keyword: string): string[] {
    return this.keywordIndex.keywords[keyword.toLowerCase()] ?? [];
  }

  lookupKeywords(keywords: string[]): Map<string, number> {
    const scores = new Map<string, number>();
    for (const kw of keywords) {
      const ids = this.lookupKeyword(kw);
      for (const id of ids) {
        scores.set(id, (scores.get(id) ?? 0) + 1);
      }
    }
    return scores;
  }

  lookupFile(filePath: string): string[] {
    return this.fileIndex.files[filePath] ?? [];
  }

  lookupFilePartial(partial: string): string[] {
    const results = new Set<string>();
    const lower = partial.toLowerCase();
    for (const [file, ids] of Object.entries(this.fileIndex.files)) {
      if (file.toLowerCase().includes(lower)) {
        for (const id of ids) {
          results.add(id);
        }
      }
    }
    return Array.from(results);
  }

  // ─── Full rebuild ──────────────────────────────────────────────

  rebuild(sessions: Record<string, SessionRegistryEntry>): void {
    this.keywordIndex = { version: 1, keywords: {} };
    this.fileIndex = { version: 1, files: {} };

    for (const [sessionId, entry] of Object.entries(sessions)) {
      this.indexSession(sessionId, entry);
    }
  }
}
