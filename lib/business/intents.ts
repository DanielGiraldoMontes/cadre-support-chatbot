export const INTENTS = [
  "KNOWLEDGE",
  "BOOK_CALL",
  "CLIENT_PORTAL",
  "PRICING",
  "ESCALATION",
  "UNKNOWN",
] as const;

export type Intent = (typeof INTENTS)[number];

export function isIntent(value: string): value is Intent {
  return (INTENTS as readonly string[]).includes(value);
}
