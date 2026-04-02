import { BaseEmbeddingProvider } from "./base";

// ─── Ollama Local Embedding Provider ───────────────────────────────
// Uses nomic-embed-text by default. Free, local, no API key needed.
// Requires Ollama running locally: https://ollama.com

export class OllamaEmbeddingProvider extends BaseEmbeddingProvider {
  readonly name = "ollama";

  constructor(
    private readonly model = "nomic-embed-text",
    private readonly baseUrl = "http://localhost:11434"
  ) {
    super();
  }

  async embed(text: string): Promise<number[]> {
    const truncated = this.truncateText(text, 8000);

    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt: truncated,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama API error: ${response.status}. Is Ollama running at ${this.baseUrl}?`
      );
    }

    const data = (await response.json()) as { embedding: number[] };
    return data.embedding;
  }
}
