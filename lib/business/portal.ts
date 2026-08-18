import type { TopicId } from "@/lib/knowledge/generated";

/**
 * Deterministic grounding source for CLIENT_PORTAL (CLAUDE.md Section 14).
 */
export function getPortalTopics(): TopicId[] {
  return ["portal"];
}
