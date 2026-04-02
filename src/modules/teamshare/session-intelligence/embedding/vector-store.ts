import * as fs from "fs";
import * as path from "path";
import type { VectorStore as VectorStoreData } from "../types";
import { TEAMSHARE_DIR, VECTORS_DIR } from "../types";

// ─── Vector Store ──────────────────────────────────────────────────
// Simple JSON-based vector storage. Sufficient for <1000 sessions.
// For scale: migrate to SQLite with sqlite-vec extension.

export class VectorStore {
  private data: VectorStoreData;
  private dirty = false;

  constructor(
    private readonly projectRoot: string,
    model: string,
    dimensions: number
  ) {
    this.data = this.load() ?? { model, dimensions, vectors: {} };
  }

  private getStorePath(): string {
    return path.join(this.projectRoot, TEAMSHARE_DIR, VECTORS_DIR, "index.json");
  }

  private load(): VectorStoreData | null {
    try {
      const raw = fs.readFileSync(this.getStorePath(), "utf-8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  save(): void {
    if (!this.dirty) {
      return;
    }
    const storePath = this.getStorePath();
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    fs.writeFileSync(storePath, JSON.stringify(this.data));
    this.dirty = false;
  }

  has(sessionId: string): boolean {
    return sessionId in this.data.vectors;
  }

  get(sessionId: string): number[] | null {
    return this.data.vectors[sessionId] ?? null;
  }

  set(sessionId: string, vector: number[]): void {
    this.data.vectors[sessionId] = vector;
    this.dirty = true;
  }

  remove(sessionId: string): void {
    delete this.data.vectors[sessionId];
    this.dirty = true;
  }

  getAllIds(): string[] {
    return Object.keys(this.data.vectors);
  }

  getAll(): Record<string, number[]> {
    return this.data.vectors;
  }

  size(): number {
    return Object.keys(this.data.vectors).length;
  }
}
