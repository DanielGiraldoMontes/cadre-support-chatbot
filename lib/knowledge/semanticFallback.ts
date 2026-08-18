import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmbeddingProvider } from "@/lib/ai/provider";
import { createServiceClient } from "@/lib/supabase/serviceClient";
import type { TopicId } from "@/lib/knowledge/generated";

/**
 * Cosine-similarity threshold for match_knowledge_embedding (CLAUDE.md
 * Section 9, Step 2). Documented, untuned, conservative default — not
 * derived from a real eval set. Unrelated short texts typically land
 * ~0.0-0.3 cosine similarity with text-embedding-3-small; same-topic
 * paraphrases commonly land 0.6-0.85+. 0.75 biases toward precision (more
 * escalations, fewer wrong-topic answers), which is the correct failure
 * direction per CLAUDE.md Section 3 ("a safe limitation is better than a
 * confident hallucination"). Revisit once real usage data exists.
 */
export const SIMILARITY_THRESHOLD = 0.75;

interface MatchRow {
  topic_id: string;
  similarity: number;
}

/**
 * Step 2 semantic fallback (CLAUDE.md Section 9) — only called when Step 1's
 * selectTopics() returns no match for a KNOWLEDGE-intent message. Never
 * throws: any embedding or query failure degrades to "no match" so the
 * caller falls through to escalation, the same fail-safe direction as every
 * other uncertainty path in this app.
 */
export async function semanticFallback(
  message: string,
  embeddingProvider: EmbeddingProvider,
  supabase: SupabaseClient = createServiceClient(),
): Promise<TopicId | null> {
  try {
    const embedding = await embeddingProvider.embed(message);
    const { data, error } = await supabase.rpc("match_knowledge_embedding", {
      query_embedding: embedding,
      match_threshold: SIMILARITY_THRESHOLD,
      match_count: 1,
    });

    if (error) {
      console.error("semanticFallback: RPC failed", error);
      return null;
    }

    const rows = (data ?? []) as MatchRow[];
    return rows.length > 0 ? (rows[0].topic_id as TopicId) : null;
  } catch (error) {
    console.error("semanticFallback: embed/query failed", error);
    return null;
  }
}
