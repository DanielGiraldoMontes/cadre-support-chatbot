export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  escalated?: boolean;
}

export const STARTER_PROMPTS = [
  "What does Cadre AI do?",
  "Do you work with my industry?",
  "What is the AI Maturity Index?",
  "How can I get started?",
] as const;
