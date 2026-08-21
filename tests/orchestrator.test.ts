import { describe, expect, it } from "vitest";
import { runOrchestrator } from "@/lib/ai/orchestrator";
import type { EmbeddingProvider, LLMInput, LLMProvider, LLMResponse } from "@/lib/ai/provider";
import { CADRE_CONTACT_URL } from "@/lib/business/booking";
import { selectTopics } from "@/lib/business/topicRouting";

function fakeProvider(opts: {
  intent: string;
  reply?: string;
}): LLMProvider {
  return {
    async generateResponse(input: LLMInput): Promise<LLMResponse> {
      if (input.jsonMode) {
        return { content: JSON.stringify({ intent: opts.intent }) };
      }
      return { content: opts.reply ?? "grounded reply" };
    },
  };
}

describe("runOrchestrator", () => {
  it("routes a KNOWLEDGE intent with a topic match to a grounded reply", async () => {
    const provider = fakeProvider({ intent: "KNOWLEDGE", reply: "Cadre AI is a consultancy." });
    const result = await runOrchestrator(
      { message: "What does Cadre AI do?", history: [] },
      provider,
    );

    expect(result.intent).toBe("KNOWLEDGE");
    expect(result.matchedTopics).toEqual(["about-cadre", "services"]);
    expect(result.escalation).toBeNull();
    expect(result.reply).toBe("Cadre AI is a consultancy.");
    expect(result.cta).toBeNull();
  });

  it("routes BOOK_CALL to the getting-started topic with a verified booking CTA", async () => {
    const provider = fakeProvider({ intent: "BOOK_CALL", reply: "Talk to an AI strategist." });
    const result = await runOrchestrator(
      { message: "I'd like to speak with someone", history: [] },
      provider,
    );

    expect(result.intent).toBe("BOOK_CALL");
    expect(result.matchedTopics).toEqual(["getting-started"]);
    expect(result.escalation).toBeNull();
    expect(result.cta).toEqual({ label: "Talk to an AI Strategist", url: CADRE_CONTACT_URL });
  });

  it("routes CLIENT_PORTAL to the portal topic", async () => {
    const provider = fakeProvider({ intent: "CLIENT_PORTAL", reply: "Here's how the portal works." });
    const result = await runOrchestrator(
      { message: "How do I log into the portal?", history: [] },
      provider,
    );

    expect(result.matchedTopics).toEqual(["portal"]);
  });

  it("routes PRICING to the pricing topic", async () => {
    const provider = fakeProvider({ intent: "PRICING", reply: "Pricing is bespoke." });
    const result = await runOrchestrator({ message: "What does this cost?", history: [] }, provider);

    expect(result.matchedTopics).toEqual(["pricing"]);
  });

  it("escalates on UNKNOWN intent without calling for a grounded reply", async () => {
    const provider = fakeProvider({ intent: "UNKNOWN" });
    const result = await runOrchestrator({ message: "Can you help me file my taxes?", history: [] }, provider);

    expect(result.escalation?.reason).toBe("unsupported_request");
    expect(result.matchedTopics).toEqual([]);
    expect(result.cta).toEqual({ label: "Talk to an AI Strategist", url: CADRE_CONTACT_URL });
  });

  it("escalates a KNOWLEDGE intent with no topic match", async () => {
    const provider = fakeProvider({ intent: "KNOWLEDGE" });
    const result = await runOrchestrator(
      { message: "Do you support underwater basket weaving companies?", history: [] },
      provider,
    );

    expect(result.escalation?.reason).toBe("no_knowledge_match");
  });

  it("escalates ESCALATION intent as client_specific", async () => {
    const provider = fakeProvider({ intent: "ESCALATION" });
    const result = await runOrchestrator({ message: "I need to talk to a human about my account", history: [] }, provider);

    expect(result.escalation?.reason).toBe("client_specific");
    expect(result.cta).toEqual({ label: "Talk to an AI Strategist", url: CADRE_CONTACT_URL });
  });

  it("resolves a bare follow-up using recent user history", async () => {
    const provider = fakeProvider({ intent: "KNOWLEDGE", reply: "Yes, we work with construction." });
    const result = await runOrchestrator(
      {
        message: "and construction?",
        history: [
          { role: "user", content: "Do you work with real estate firms?" },
          { role: "assistant", content: "Yes, real estate is one of our focus industries." },
        ],
      },
      provider,
    );

    expect(result.matchedTopics).toEqual(["industries"]);
  });

  it("uses the semantic fallback when Step 1 finds nothing for a KNOWLEDGE question", async () => {
    const provider = fakeProvider({
      intent: "KNOWLEDGE",
      reply: "Yes — our AI Maturity Index scores a business across eight pillars.",
    });
    const fakeEmbeddingProvider: EmbeddingProvider = { async embed() { return [0.1, 0.2, 0.3]; } };
    const fakeSupabase = {
      rpc: () => ({
        abortSignal: () => Promise.resolve({ data: [{ topic_id: "ai-maturity-index", similarity: 0.86 }] }),
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const message = "How do you measure how AI-ready a company is?";
    // Sanity-check the premise: this phrasing must NOT already match via
    // Step 1 keyword lookup, or the test wouldn't be exercising Step 2 at all.
    expect(selectTopics(message)).toEqual([]);

    const result = await runOrchestrator(
      { message, history: [] },
      provider,
      { embeddingProvider: fakeEmbeddingProvider, supabase: fakeSupabase },
    );

    expect(result.matchedTopics).toEqual(["ai-maturity-index"]);
    expect(result.escalation).toBeNull();
  });

  it("falls back to UNKNOWN and escalates when classification fails", async () => {
    const brokenProvider: LLMProvider = {
      async generateResponse(input: LLMInput): Promise<LLMResponse> {
        if (input.jsonMode) {
          return { content: "not json" };
        }
        return { content: "should not be reached" };
      },
    };

    const result = await runOrchestrator({ message: "asdkjhasd", history: [] }, brokenProvider);
    expect(result.intent).toBe("UNKNOWN");
    expect(result.escalation).not.toBeNull();
  });
});
