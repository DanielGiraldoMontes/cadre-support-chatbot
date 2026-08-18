import { describe, expect, it } from "vitest";
import { semanticFallback, SIMILARITY_THRESHOLD } from "@/lib/knowledge/semanticFallback";
import type { EmbeddingProvider } from "@/lib/ai/provider";

const fakeEmbeddingProvider: EmbeddingProvider = {
  async embed() {
    return [0.1, 0.2, 0.3];
  },
};

function fakeSupabase(response: { data?: unknown; error?: unknown }) {
  return {
    rpc: async () => response,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("semanticFallback", () => {
  it("resolves the top match when it clears the similarity threshold", async () => {
    const supabase = fakeSupabase({
      data: [{ topic_id: "ai-maturity-index", similarity: SIMILARITY_THRESHOLD + 0.1 }],
    });

    const result = await semanticFallback("your eight-pillar scoring thing", fakeEmbeddingProvider, supabase);

    expect(result).toBe("ai-maturity-index");
  });

  it("returns null when the RPC finds nothing above the threshold", async () => {
    const supabase = fakeSupabase({ data: [] });

    const result = await semanticFallback("do you support underwater basket weaving", fakeEmbeddingProvider, supabase);

    expect(result).toBeNull();
  });

  it("returns null (not a throw) when the RPC errors", async () => {
    const supabase = fakeSupabase({ error: { message: "connection refused" } });

    const result = await semanticFallback("what does cadre do", fakeEmbeddingProvider, supabase);

    expect(result).toBeNull();
  });

  it("returns null (not a throw) when embedding itself fails", async () => {
    const brokenEmbeddingProvider: EmbeddingProvider = {
      async embed() {
        throw new Error("network down");
      },
    };
    const supabase = fakeSupabase({ data: [] });

    const result = await semanticFallback("what does cadre do", brokenEmbeddingProvider, supabase);

    expect(result).toBeNull();
  });
});
