import { BaseEmbeddingProvider } from "./base";

// ─── OpenAI Embedding Provider ─────────────────────────────────────
// Uses text-embedding-3-small by default.
// Requires OPENAI_API_KEY environment variable or config.

export class OpenAIEmbeddingProvider extends BaseEmbeddingProvider {
  readonly name = "openai";

  constructor(
    private readonly apiKey: string,
    private readonly model = "text-embedding-3-small",
    private readonly dimensions = 256
  ) {
    super();
  }

  async embed(text: string): Promise<number[]> {
    const truncated = this.truncateText(text, 8000);

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: truncated,
        dimensions: this.dimensions,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      data: { embedding: number[] }[];
    };

    return data.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const truncated = texts.map((t) => this.truncateText(t, 8000));

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: truncated,
        dimensions: this.dimensions,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      data: { embedding: number[] }[];
    };

    return data.data.map((d) => d.embedding);
  }
}
