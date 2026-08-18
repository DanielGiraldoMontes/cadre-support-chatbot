import { describe, expect, it } from "vitest";
import { runOrchestrator } from "@/lib/ai/orchestrator";
import { SYSTEM_PROMPT } from "@/lib/ai/prompts";
import type { LLMInput, LLMProvider, LLMResponse } from "@/lib/ai/provider";
import { EVALUATION_SET } from "@/tests/fixtures/evaluationSet";

function fixtureProvider(expectedIntent: string, capture: LLMInput[]): LLMProvider {
  return {
    async generateResponse(input: LLMInput): Promise<LLMResponse> {
      capture.push(input);
      if (input.jsonMode) {
        return { content: JSON.stringify({ intent: expectedIntent }) };
      }
      return { content: "A grounded, on-policy reply." };
    },
  };
}

describe("AI evaluation set (CLAUDE.md Section 23)", () => {
  it.each(EVALUATION_SET)(
    "[$category] $input",
    async ({ input, expectedIntent, expectedOutcome, expectedTopics }) => {
      const calls: LLMInput[] = [];
      const provider = fixtureProvider(expectedIntent, calls);

      const result = await runOrchestrator({ message: input, history: [] }, provider);

      expect(result.intent).toBe(expectedIntent);

      if (expectedOutcome === "answer") {
        expect(result.escalation).toBeNull();
        expect(result.matchedTopics).toEqual(expectedTopics);
      } else {
        expect(result.escalation).not.toBeNull();
        expect(result.matchedTopics).toEqual([]);
      }

      // Regardless of outcome, the real system prompt is always what's sent —
      // the user's input can never substitute for it (prompt-injection floor).
      const generationCall = calls.find((c) => !c.jsonMode);
      if (generationCall) {
        expect(generationCall.messages[0]).toEqual({ role: "system", content: SYSTEM_PROMPT });
      }
    },
  );
});
