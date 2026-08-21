"use client";

import { useEffect, useRef, useState } from "react";
import { getOrCreateConversationId } from "@/lib/chat/conversationId";
import type { ChatMessage } from "@/lib/chat/types";
import { Composer } from "@/components/chat/Composer";
import { MessageList } from "@/components/chat/MessageList";

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export function ChatContainer() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const nextId = useRef(0);

  useEffect(() => {
    const id = getOrCreateConversationId();
    conversationIdRef.current = id;

    fetch(`/api/chat?conversationId=${id}`)
      .then((res) => (res.ok ? res.json() : { messages: [] }))
      .then((data: { messages: HistoryMessage[] }) => {
        setMessages(
          data.messages.map((m) => ({
            id: String(nextId.current++),
            role: m.role,
            content: m.content,
          })),
        );
      })
      .catch(() => {
        // History recovery is best-effort — an empty start is an acceptable fallback.
      })
      .finally(() => setReady(true));
  }, []);

  async function sendMessage(text: string) {
    const conversationId = conversationIdRef.current;
    if (!conversationId || loading) return;

    setMessages((prev) => [...prev, { id: String(nextId.current++), role: "user", content: text }]);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? "Something went wrong. Please try again.");
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: String(nextId.current++),
          role: "assistant",
          content: data.reply,
          escalated: data.escalated,
          cta: data.cta,
          intent: data.intent,
        },
      ]);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full max-w-2xl flex-1 flex-col">
      <MessageList messages={messages} loading={loading} onStarterPromptSelect={sendMessage} />
      {error && (
        <p
          role="alert"
          className="mx-4 mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300"
        >
          {error}
        </p>
      )}
      <Composer onSend={sendMessage} disabled={loading || !ready} />
    </div>
  );
}
