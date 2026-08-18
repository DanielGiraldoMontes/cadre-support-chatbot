import type { ChatMessage } from "@/lib/chat/types";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { StarterPrompts } from "@/components/chat/StarterPrompts";

interface Props {
  messages: ChatMessage[];
  loading: boolean;
  onStarterPromptSelect: (text: string) => void;
}

export function MessageList({ messages, loading, onStarterPromptSelect }: Props) {
  if (messages.length === 0 && !loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
        <div>
          <h2 className="text-xl font-semibold text-cadre-primary">Ask Cadre AI Support</h2>
          <p className="mt-1 text-sm text-cadre-muted">
            Ask about services, industries, the AI Maturity Index, or getting started.
          </p>
        </div>
        <StarterPrompts onSelect={onStarterPromptSelect} />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      {loading && (
        <MessageBubble message={{ id: "loading", role: "assistant", content: "" }} loading />
      )}
    </div>
  );
}
