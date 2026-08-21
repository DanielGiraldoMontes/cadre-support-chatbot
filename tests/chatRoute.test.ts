import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: (fn: () => unknown) => fn() };
});

vi.mock("@/lib/api/rateLimit", () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/supabase/repository", () => ({
  upsertConversation: vi.fn(),
  getRecentMessages: vi.fn().mockResolvedValue([]),
  appendMessage: vi.fn().mockResolvedValue("message-id"),
  touchConversation: vi.fn(),
  recordEscalation: vi.fn(),
}));

vi.mock("@/lib/ai/orchestrator", () => ({
  runOrchestrator: vi.fn(),
}));

import { POST } from "@/app/api/chat/route";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { runOrchestrator } from "@/lib/ai/orchestrator";
import { ProviderError } from "@/lib/ai/provider";

const VALID_CONVERSATION_ID = "11111111-1111-4111-8111-111111111111";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
  });
}

beforeEach(() => {
  vi.mocked(checkRateLimit).mockReset().mockResolvedValue({ allowed: true });
  vi.mocked(runOrchestrator).mockReset();
});

describe("POST /api/chat", () => {
  it("rejects malformed input", async () => {
    const res = await POST(makeRequest({ conversationId: "not-a-uuid", message: "" }));
    expect(res.status).toBe(400);
  });

  it("returns a friendly 429 when rate limited", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false });

    const res = await POST(
      makeRequest({ conversationId: VALID_CONVERSATION_ID, message: "hello" }),
    );
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe("rate_limited");
  });

  it("returns the orchestrator's reply on success", async () => {
    vi.mocked(runOrchestrator).mockResolvedValue({
      reply: "Cadre AI is a consultancy.",
      intent: "KNOWLEDGE",
      matchedTopics: ["about-cadre"],
      escalation: null,
      cta: null,
    });

    const res = await POST(
      makeRequest({ conversationId: VALID_CONVERSATION_ID, message: "What does Cadre do?" }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reply).toBe("Cadre AI is a consultancy.");
    expect(json.escalated).toBe(false);
    expect(json.cta).toBeNull();
    expect(json.intent).toBe("KNOWLEDGE");
  });

  it("passes through the orchestrator's booking CTA", async () => {
    const cta = { label: "Talk to an AI Strategist", url: "https://www.cadreai.com/contact" };
    vi.mocked(runOrchestrator).mockResolvedValue({
      reply: "Here's how to get started.",
      intent: "BOOK_CALL",
      matchedTopics: ["getting-started"],
      escalation: null,
      cta,
    });

    const res = await POST(
      makeRequest({ conversationId: VALID_CONVERSATION_ID, message: "I'd like to book a call" }),
    );
    const json = await res.json();
    expect(json.cta).toEqual(cta);
  });

  it("returns 502 with a friendly message on provider failure", async () => {
    vi.mocked(runOrchestrator).mockRejectedValue(new ProviderError("boom", "timeout"));

    const res = await POST(
      makeRequest({ conversationId: VALID_CONVERSATION_ID, message: "hello" }),
    );
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe("provider_error");
  });
});
