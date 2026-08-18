import type { TopicId } from "@/lib/knowledge/generated";

// Copied verbatim from knowledge/industries.md — do not re-derive.
export const INDUSTRIES = [
  "Professional Services",
  "Private Equity",
  "Real Estate",
  "Financial Services",
  "Mortgage & Lending",
  "Construction",
  "Retail & E-commerce",
  "Manufacturing & Logistics",
  "Hospitality",
] as const;

export type Industry = (typeof INDUSTRIES)[number];

// Lowercase substring aliases per industry, so phrasing like "construction
// companies" or "PE-backed" still resolves without requiring the exact
// multi-word label from industries.md.
const INDUSTRY_ALIASES: Record<Industry, string[]> = {
  "Professional Services": ["professional services"],
  "Private Equity": ["private equity", "pe-backed", "pe backed", "pe firm"],
  "Real Estate": ["real estate"],
  "Financial Services": ["financial services"],
  "Mortgage & Lending": ["mortgage", "lending"],
  Construction: ["construction"],
  "Retail & E-commerce": ["retail", "e-commerce", "ecommerce"],
  "Manufacturing & Logistics": ["manufacturing", "logistics"],
  Hospitality: ["hospitality", "hotel"],
};

// Fixed topic -> trigger-terms map (CLAUDE.md Section 9, Step 1.2).
const TOPIC_TRIGGER_TERMS: Partial<Record<TopicId, string[]>> = {
  "ai-maturity-index": [
    "maturity index",
    "maturity score",
    "eight-pillar",
    "eight pillar",
    "assessment",
    "how mature",
  ],
  "llm-selection": [
    "which model",
    "llm selection",
    "gpt vs claude",
    "model choice",
    "which llm",
    "choose a model",
    "choosing a model",
  ],
  security: ["data security", "encryption", "privacy", "confidential", "secure", "compliance"],
  services: ["what do you do", "services", "what do you offer", "capabilities"],
};

// General "tell me about the company" phrasing that isn't caught by a more
// specific trigger term above — the deliberate Section 9 Step 3 default.
const GENERIC_ABOUT_TERMS = [
  "what does cadre",
  "who is cadre",
  "about cadre",
  "what is cadre",
  "tell me about your company",
  "tell me about cadre",
];

function matchIndustry(haystack: string): Industry | null {
  for (const industry of INDUSTRIES) {
    if (INDUSTRY_ALIASES[industry].some((alias) => haystack.includes(alias))) {
      return industry;
    }
  }
  return null;
}

function matchTriggerTopic(haystack: string): TopicId | null {
  for (const [topicId, terms] of Object.entries(TOPIC_TRIGGER_TERMS)) {
    if (terms!.some((term) => haystack.includes(term))) {
      return topicId as TopicId;
    }
  }
  return null;
}

/**
 * Deterministic topic lookup (CLAUDE.md Section 9, Step 1 / PLAN.md Phase 7).
 * `recentContext` should be the last 1-2 prior user messages so a bare
 * follow-up ("and construction?") still resolves using what was asked before it.
 * Returns [] when nothing matches — callers should escalate on an empty result.
 */
export function selectTopics(message: string, recentContext: string[] = []): TopicId[] {
  const haystack = [message, ...recentContext].join(" ").toLowerCase();

  if (matchIndustry(haystack)) {
    return ["industries"];
  }

  const triggered = matchTriggerTopic(haystack);
  if (triggered) {
    return [triggered];
  }

  if (GENERIC_ABOUT_TERMS.some((term) => haystack.includes(term))) {
    return ["about-cadre", "services"];
  }

  return [];
}
