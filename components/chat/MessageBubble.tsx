import type { ChatMessage } from "@/lib/chat/types";

interface Props {
  message: ChatMessage;
  loading?: boolean;
}

export function MessageBubble({ message, loading }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        data-testid="message-bubble"
        data-role={message.role}
        data-escalated={Boolean(message.escalated)}
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-cadre-primary text-cadre-primary-foreground"
            : message.escalated
              ? "border border-amber-200 bg-amber-50 text-amber-900"
              : "border border-black/10 bg-white text-foreground"
        }`}
      >
        {loading ? (
          <span className="inline-flex items-center gap-1 py-0.5" aria-label="Assistant is typing">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
          </span>
        ) : (
          message.content
        )}
      </div>
    </div>
  );
}
