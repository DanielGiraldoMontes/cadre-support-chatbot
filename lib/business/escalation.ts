export const ESCALATION_REASONS = [
  "unsupported_request",
  "no_knowledge_match",
  "client_specific",
  "unverifiable_fact",
  "missing_capability",
] as const;

export type EscalationReason = (typeof ESCALATION_REASONS)[number];

export interface EscalationResult {
  reason: EscalationReason;
  message: string;
}

const ESCALATION_MESSAGE =
  "I don't have enough verified information to answer that accurately. I can help with Cadre's services, industries, the AI Maturity Index, and how to get started. For a client-specific question, the best next step is to speak with the Cadre team — you can talk with an AI strategist.";

export function buildEscalation(reason: EscalationReason): EscalationResult {
  return { reason, message: ESCALATION_MESSAGE };
}
