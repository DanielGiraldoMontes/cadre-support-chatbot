import { getProvider } from "@/lib/ai/getProvider";
import { SYSTEM_PROMPT, buildIntentClassificationPrompt } from "@/lib/ai/prompts";
import { ProviderError, type LLMProvider } from "@/lib/ai/provider";
import { IntentClassificationSchema } from "@/lib/ai/schemas";
import { getBookingTopics } from "@/lib/business/booking";
import {
  buildEscalation,
  type EscalationReason,
  type EscalationResult,
} from "@/lib/business/escalation";
import type { Intent } from "@/lib/business/intents";
import { getPortalTopics } from "@/lib/business/portal";
import { selectTopics } from "@/lib/business/topicRouting";
import { KNOWLEDGE_TOPICS, type TopicId } from "@/lib/knowledge/generated";
import type { StoredMessage } from "@/lib/supabase/repository";

// Bound how much history feeds the (cheaper, structured) classification call.
const CLASSIFICATION_HISTORY_TURNS = 6;
const TOPIC_CONTEXT_MESSAGES = 2;

export interface OrchestratorInput {
  message: string;
  history: StoredMessage[]; // already capped and ordered oldest-first
}

export interface OrchestratorResult {
  reply: string;
  intent: Intent;
  matchedTopics: TopicId[];
  escalation: EscalationResult | null;
}

async function classifyIntent(
  provider: LLMProvider,
  message: string,
  history: StoredMessage[],
): Promise<Intent> {
  try {
    const response = await provider.generateResponse({
      jsonMode: true,
      messages: [
        { role: "system", content: buildIntentClassificationPrompt() },
        ...history.slice(-CLASSIFICATION_HISTORY_TURNS).map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: message },
      ],
    });
    const parsed = IntentClassificationSchema.safeParse(JSON.parse(response.content));
    return parsed.success ? parsed.data.intent : "UNKNOWN";
  } catch {
    // Classification failure routes to a safe fallback (CLAUDE.md Section 7)
    // rather than failing the whole request.
    return "UNKNOWN";
  }
}

function recentUserMessages(history: StoredMessage[]): string[] {
  return history
    .filter((m) => m.role === "user")
    .slice(-TOPIC_CONTEXT_MESSAGES)
    .map((m) => m.content);
}

function resolveTopics(intent: Intent, message: string, history: StoredMessage[]): TopicId[] {
  switch (intent) {
    case "KNOWLEDGE":
      return selectTopics(message, recentUserMessages(history));
    case "BOOK_CALL":
      return getBookingTopics();
    case "CLIENT_PORTAL":
      return getPortalTopics();
    case "PRICING":
      return ["pricing"];
    case "ESCALATION":
    case "UNKNOWN":
      return [];
  }
}

// Only KNOWLEDGE, ESCALATION, and UNKNOWN can ever resolve to zero topics —
// BOOK_CALL/CLIENT_PORTAL/PRICING map to a fixed topic above.
function escalationReasonFor(intent: Intent): EscalationReason {
  switch (intent) {
    case "KNOWLEDGE":
      return "no_knowledge_match";
    case "ESCALATION":
      return "client_specific";
    default:
      return "unsupported_request";
  }
}

async function generateGroundedReply(
  provider: LLMProvider,
  params: {
    message: string;
    history: StoredMessage[];
    topics: TopicId[];
  },
): Promise<string> {
  const knowledgeContent = params.topics
    .map((id) => `## ${KNOWLEDGE_TOPICS[id].title}\n${KNOWLEDGE_TOPICS[id].content}`)
    .join("\n\n");

  const response = await provider.generateResponse({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `Verified Cadre knowledge for this turn:\n\n${knowledgeContent}` },
      ...params.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: params.message },
    ],
  });

  const reply = response.content.trim();
  if (!reply) {
    throw new ProviderError("Provider returned an empty response", "invalid_response");
  }
  return reply;
}

/**
 * message -> classify -> route -> topic lookup/business flow/escalation ->
 * grounded response generation (CLAUDE.md Section 6). Rate limiting,
 * persistence, and HTTP-level error handling live in the route handler.
 */
export async function runOrchestrator(
  input: OrchestratorInput,
  provider: LLMProvider = getProvider(),
): Promise<OrchestratorResult> {
  const message = input.message.trim();
  const intent = await classifyIntent(provider, message, input.history);
  const topics = resolveTopics(intent, message, input.history);

  if (topics.length === 0) {
    const escalation = buildEscalation(escalationReasonFor(intent));
    return { reply: escalation.message, intent, matchedTopics: [], escalation };
  }

  const reply = await generateGroundedReply(provider, { message, history: input.history, topics });
  return { reply, intent, matchedTopics: topics, escalation: null };
}
