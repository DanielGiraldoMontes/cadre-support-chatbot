import { MockLLMProvider } from "@/lib/ai/mockProvider";
import { OpenRouterProvider } from "@/lib/ai/openrouter";
import type { LLMProvider } from "@/lib/ai/provider";

let cachedProvider: LLMProvider | null = null;

/**
 * Single place the USE_MOCK_LLM toggle is read (CLAUDE.md Section 4 / PLAN.md
 * Phase 4) — never branch on it elsewhere in the orchestrator.
 */
export function getProvider(): LLMProvider {
  if (cachedProvider) return cachedProvider;

  if (process.env.USE_MOCK_LLM === "true") {
    cachedProvider = new MockLLMProvider();
    return cachedProvider;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  if (!apiKey || !model) {
    throw new Error(
      "OPENROUTER_API_KEY and OPENROUTER_MODEL must be set (or USE_MOCK_LLM=true for local dev)",
    );
  }

  cachedProvider = new OpenRouterProvider(apiKey, model);
  return cachedProvider;
}
