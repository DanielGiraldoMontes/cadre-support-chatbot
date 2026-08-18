const STORAGE_KEY = "cadre-conversation-id";

/** Client-generated conversationId, persisted in localStorage (CLAUDE.md Section 16). */
export function getOrCreateConversationId(): string {
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const id = crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, id);
  return id;
}
