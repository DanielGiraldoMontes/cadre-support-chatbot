import type { LLMInput, LLMProvider, LLMResponse } from "@/lib/ai/provider";

/**
 * Zero-cost provider for local dev/manual smoke testing (CLAUDE.md Section 4
 * "Development testing practice", PLAN.md Phase 4). Never used in automated
 * unit tests, which supply their own fixed provider stubs directly.
 */
const MOCK_INTENT_KEYWORDS: Array<{ intent: string; terms: string[] }> = [
  { intent: "BOOK_CALL", terms: ["book", "call", "strategist", "talk to someone", "schedule"] },
  { intent: "CLIENT_PORTAL", terms: ["portal", "log in", "login", "dashboard"] },
  { intent: "PRICING", terms: ["price", "pricing", "cost", "how much"] },
  {
    intent: "KNOWLEDGE",
    terms: ["what", "how", "do you", "does cadre", "industry", "industries", "security", "maturity"],
  },
];

function guessMockIntent(message: string): string {
  const lower = message.toLowerCase();
  for (const { intent, terms } of MOCK_INTENT_KEYWORDS) {
    if (terms.some((term) => lower.includes(term))) {
      return intent;
    }
  }
  return "UNKNOWN";
}

export class MockLLMProvider implements LLMProvider {
  async generateResponse(input: LLMInput): Promise<LLMResponse> {
    const lastUserMessage =
      [...input.messages].reverse().find((m) => m.role === "user")?.content ?? "";

    if (input.jsonMode) {
      return { content: JSON.stringify({ intent: guessMockIntent(lastUserMessage) }) };
    }

    return {
      content:
        "[mock response] This is a canned reply from the local mock provider — no OpenRouter call was made.",
    };
  }
}
