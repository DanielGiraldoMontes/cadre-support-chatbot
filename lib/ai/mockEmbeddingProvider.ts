import type { EmbeddingProvider } from "@/lib/ai/provider";

const DIMENSIONS = 1536;

/**
 * Zero-cost embedding provider for local dev (CLAUDE.md Section 4 /
 * PLAN.md Phase 4, same toggle as MockLLMProvider). Produces a deterministic
 * unit vector derived from the text's character codes
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    const vector = new Array(DIMENSIONS).fill(0);
    for (let i = 0; i < text.length; i++) {
      vector[i % DIMENSIONS] += text.charCodeAt(i);
    }
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vector.map((v) => v / magnitude);
  }
}
