import type { TopicId } from "@/lib/knowledge/generated";

/**
 * Deterministic grounding source for BOOK_CALL (CLAUDE.md Section 13).
 */
export function getBookingTopics(): TopicId[] {
  return ["getting-started"];
}
