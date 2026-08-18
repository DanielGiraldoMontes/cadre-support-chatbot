import { z } from "zod";
import { INTENTS } from "@/lib/business/intents";

export const IntentClassificationSchema = z.object({
  intent: z.enum(INTENTS),
});

export type IntentClassification = z.infer<typeof IntentClassificationSchema>;

export const ChatRequestSchema = z.object({
  conversationId: z.uuid(),
  message: z.string().trim().min(1).max(4000),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// openai/text-embedding-3-small via OpenRouter — 1536 dimensions (CLAUDE.md Section 9, Step 2).
export const EmbeddingResponseSchema = z.object({
  data: z.array(z.object({ embedding: z.array(z.number()).length(1536) })).min(1),
});
