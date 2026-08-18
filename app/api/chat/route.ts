import { after } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { runOrchestrator } from "@/lib/ai/orchestrator";
import { ProviderError } from "@/lib/ai/provider";
import { ChatRequestSchema } from "@/lib/ai/schemas";
import { getClientIp } from "@/lib/api/getClientIp";
import { checkRateLimit } from "@/lib/api/rateLimit";
import {
  appendMessage,
  getRecentMessages,
  recordEscalation,
  touchConversation,
  upsertConversation,
} from "@/lib/supabase/repository";

export async function GET(request: Request) {
  const conversationId = new URL(request.url).searchParams.get("conversationId");
  const parsed = z.string().uuid().safeParse(conversationId);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", message: "A valid conversationId is required." },
      { status: 400 },
    );
  }

  try {
    const history = await getRecentMessages(parsed.data);
    return NextResponse.json({ messages: history });
  } catch (error) {
    console.error("Failed to load conversation history", error);
    return NextResponse.json({ messages: [] });
  }
}

export async function POST(request: Request) {
  const parsed = ChatRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", message: "Message could not be read." },
      { status: 400 },
    );
  }
  const { conversationId, message } = parsed.data;

  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit(ip).catch(() => ({ allowed: true }));
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: "You've sent a lot of messages recently — please try again in a bit.",
      },
      { status: 429 },
    );
  }

  let history: Awaited<ReturnType<typeof getRecentMessages>> = [];
  try {
    await upsertConversation(conversationId);
    history = await getRecentMessages(conversationId);
  } catch (error) {
    console.error("Supabase read failed, continuing without history", error);
  }

  let result;
  try {
    result = await runOrchestrator({ message, history });
  } catch (error) {
    if (error instanceof ProviderError) {
      console.error("Provider error", error.kind, error.cause);
      return NextResponse.json(
        {
          error: "provider_error",
          message: "Something went wrong generating a response. Please try again in a moment.",
        },
        { status: 502 },
      );
    }
    throw error;
  }

  // Persistence must not block the response (CLAUDE.md Section 6 / PLAN.md Phase 12).
  after(async () => {
    try {
      await appendMessage({ conversationId, role: "user", content: message, intent: result.intent });
      const assistantMessageId = await appendMessage({
        conversationId,
        role: "assistant",
        content: result.reply,
        matchedTopic: result.matchedTopics[0],
      });
      await touchConversation(conversationId);
      if (result.escalation) {
        await recordEscalation({
          conversationId,
          messageId: assistantMessageId,
          reason: result.escalation.reason,
        });
      }
    } catch (error) {
      console.error("Persistence failed", error);
    }
  });

  return NextResponse.json({
    reply: result.reply,
    escalated: result.escalation !== null,
  });
}
