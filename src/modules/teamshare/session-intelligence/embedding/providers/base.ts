import type { EmbeddingProvider } from "../../types";

// ─── Embedding Provider Interface ──────────────────────────────────
// All providers implement this interface.
// Providers are lazy-loaded: only initialized when first needed.

export abstract class BaseEmbeddingProvider implements EmbeddingProvider {
  abstract readonly name: string;

  abstract embed(text: string): Promise<number[]>;

  async embedBatch(texts: string[]): Promise<number[][]> {
    // Default: sequential. Override for batch API support.
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }

  protected truncateText(text: string, maxTokens: number): string {
    // Rough token estimate: 1 token ~= 4 chars
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) {
      return text;
    }
    return text.slice(0, maxChars);
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}
