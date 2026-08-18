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
