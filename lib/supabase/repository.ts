import { createServiceClient } from "@/lib/supabase/serviceClient";
import type { Intent } from "@/lib/business/intents";
import type { EscalationReason } from "@/lib/business/escalation";

export interface StoredMessage {
  role: "user" | "assistant";
  content: string;
}

const HISTORY_LIMIT = 20;

/** Upsert-on-first-sight for a client-generated conversationId (PLAN.md Phase 2). */
export async function upsertConversation(conversationId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("conversations")
    .upsert({ id: conversationId, last_message_at: new Date().toISOString() }, { onConflict: "id" });

  if (error) throw error;
}

export async function touchConversation(conversationId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (error) throw error;
}

/** Last `HISTORY_LIMIT` messages, oldest first (Phase 8 history cap). */
export async function getRecentMessages(conversationId: string): Promise<StoredMessage[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (error) throw error;
  return (data ?? []).reverse() as StoredMessage[];
}

export async function appendMessage(params: {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  intent?: Intent;
  matchedTopic?: string;
}): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: params.conversationId,
      role: params.role,
      content: params.content,
      intent: params.intent ?? null,
      matched_topic: params.matchedTopic ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function recordEscalation(params: {
  conversationId: string;
  messageId: string;
  reason: EscalationReason;
}): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("escalations").insert({
    conversation_id: params.conversationId,
    message_id: params.messageId,
    reason: params.reason,
  });

  if (error) throw error;
}
