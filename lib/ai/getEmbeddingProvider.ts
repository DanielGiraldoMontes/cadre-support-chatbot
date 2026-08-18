import { MockEmbeddingProvider } from "@/lib/ai/mockEmbeddingProvider";
import { OpenRouterEmbeddingProvider } from "@/lib/ai/openrouter";
import type { EmbeddingProvider } from "@/lib/ai/provider";

let cachedProvider: EmbeddingProvider | null = null;

/**
 * Single place the USE_MOCK_LLM toggle is read for embeddings — mirrors
 * getProvider.ts exactly. Never branch on the toggle elsewhere.
 */
export function getEmbeddingProvider(): EmbeddingProvider {
  if (cachedProvider) return cachedProvider;

  if (process.env.USE_MOCK_LLM === "true") {
    cachedProvider = new MockEmbeddingProvider();
    return cachedProvider;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_EMBEDDING_MODEL;
  if (!apiKey || !model) {
    throw new Error(
      "OPENROUTER_API_KEY and OPENROUTER_EMBEDDING_MODEL must be set (or USE_MOCK_LLM=true for local dev)",
    );
  }

  cachedProvider = new OpenRouterEmbeddingProvider(apiKey, model);
  return cachedProvider;
}
