import * as fs from "fs";
import * as path from "path";
import type { EmbeddingConfig, EmbeddingProvider, SessionSummary } from "../types";
import { TEAMSHARE_DIR, SUMMARIES_DIR } from "../types";
import { VectorStore } from "./vector-store";
import { OpenAIEmbeddingProvider } from "./providers/openai";
import { OllamaEmbeddingProvider } from "./providers/ollama";
import { cosineSimilarity } from "./providers/base";
import { log } from "../../../../utils";

// ─── Embedding Manager ─────────────────────────────────────────────
// Orchestrates background embedding indexing and semantic search.
// Runs non-blocking: indexes new summaries in the background.

export class EmbeddingManager {
  private provider: EmbeddingProvider | null = null;
  private store: VectorStore | null = null;
  private indexQueue: string[] = [];
  private indexTimer: ReturnType<typeof setInterval> | null = null;
  private processing = false;

  constructor(
    private readonly projectRoot: string,
    private readonly config: EmbeddingConfig
  ) {
    if (config.provider !== "none") {
      this.provider = this.createProvider(config);
      this.store = new VectorStore(projectRoot, config.model, config.dimensions);
    }
  }

  get enabled(): boolean {
    return this.provider !== null;
  }

  // ─── Provider Factory ──────────────────────────────────────────

  private createProvider(config: EmbeddingConfig): EmbeddingProvider | null {
    switch (config.provider) {
      case "openai": {
        const apiKey = config.apiKey ?? process.env["OPENAI_API_KEY"];
        if (!apiKey) {
          log("OpenAI embedding: no API key configured", "warn");
          return null;
        }
        return new OpenAIEmbeddingProvider(apiKey, config.model, config.dimensions);
      }
      case "ollama":
        return new OllamaEmbeddingProvider(config.model, config.baseUrl);
      case "none":
        return null;
      default:
        log(`Unknown embedding provider: ${config.provider}`, "warn");
        return null;
    }
  }

  // ─── Background Indexing ───────────────────────────────────────

  startBackgroundIndexing(intervalMs = 30000): void {
    if (!this.enabled) {
      return;
    }

    this.detectUnindexed();

    this.indexTimer = setInterval(() => {
      this.detectUnindexed();
      this.processQueue();
    }, intervalMs);
  }

  stopBackgroundIndexing(): void {
    if (this.indexTimer) {
      clearInterval(this.indexTimer);
      this.indexTimer = null;
    }
    this.store?.save();
  }

  queueForIndexing(sessionId: string): void {
    if (!this.enabled) {
      return;
    }
    if (!this.indexQueue.includes(sessionId)) {
      this.indexQueue.push(sessionId);
    }
  }

  private detectUnindexed(): void {
    if (!this.store) {
      return;
    }

    const summariesDir = path.join(this.projectRoot, TEAMSHARE_DIR, SUMMARIES_DIR);
    try {
      const files = fs.readdirSync(summariesDir).filter((f) => f.endsWith(".json"));
      for (const file of files) {
        const sessionId = file.replace(".json", "");
        if (!this.store.has(sessionId) && !this.indexQueue.includes(sessionId)) {
          this.indexQueue.push(sessionId);
        }
      }
    } catch {
      // Summaries dir doesn't exist yet
    }
  }

  private async processQueue(): Promise<void> {
    if (!this.provider || !this.store || this.processing || this.indexQueue.length === 0) {
      return;
    }

    this.processing = true;

    // Process max 5 per cycle to avoid throttling
    const batch = this.indexQueue.splice(0, 5);

    for (const sessionId of batch) {
      try {
        const summaryText = this.loadSummaryText(sessionId);
        if (summaryText) {
          const vector = await this.provider.embed(summaryText);
          this.store.set(sessionId, vector);
          log(`Embedded session ${sessionId.slice(0, 8)}`);
        }
      } catch (err) {
        log(`Failed to embed ${sessionId.slice(0, 8)}: ${err}`, "error");
        // Re-queue for retry (at the end)
        this.indexQueue.push(sessionId);
      }

      // Rate limit: 200ms between calls
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    this.store.save();
    this.processing = false;
  }

  private loadSummaryText(sessionId: string): string | null {
    const summaryPath = path.join(
      this.projectRoot, TEAMSHARE_DIR, SUMMARIES_DIR, `${sessionId}.json`
    );
    try {
      const raw = fs.readFileSync(summaryPath, "utf-8");
      const summary = JSON.parse(raw) as SessionSummary;

      // Build embedding text from summary fields
      const parts: string[] = [
        summary.currentFocus,
        ...summary.actions.map((a) => a.description),
        ...summary.decisions,
        ...summary.files.map((f) => f.path),
        ...summary.openItems,
      ];

      return parts.join(". ");
    } catch {
      return null;
    }
  }

  // ─── Semantic Search ───────────────────────────────────────────

  async search(query: string, topK = 10, threshold = 0.3): Promise<{ sessionId: string; score: number }[]> {
    if (!this.provider || !this.store) {
      return [];
    }

    const queryVector = await this.provider.embed(query);
    const allVectors = this.store.getAll();

    const results: { sessionId: string; score: number }[] = [];

    for (const [sessionId, vector] of Object.entries(allVectors)) {
      const score = cosineSimilarity(queryVector, vector);
      if (score >= threshold) {
        results.push({ sessionId, score });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  dispose(): void {
    this.stopBackgroundIndexing();
  }
}
