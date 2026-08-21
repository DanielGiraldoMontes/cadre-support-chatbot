import type { TopicId } from "@/lib/knowledge/generated";

/**
 * Deterministic grounding source for BOOK_CALL (CLAUDE.md Section 13).
 */
export function getBookingTopics(): TopicId[] {
  return ["getting-started"];
}

/**
 * The only verified, non-invented next step Cadre AI publishes for starting
 * a conversation with an AI strategist (CLAUDE.md Section 13 — never invent
 * a booking URL). Surfaced as a clickable CTA whenever the bot points a user
 * toward talking to a human, so "the next step" is an actual link, not just
 * a sentence.
 */
export const CADRE_CONTACT_URL = "https://www.cadreai.com/contact";

export interface BookingCta {
  label: string;
  url: string;
}

export function getBookingCta(): BookingCta {
  return { label: "Talk to an AI Strategist", url: CADRE_CONTACT_URL };
}
