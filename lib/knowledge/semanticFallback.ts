import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmbeddingProvider } from "@/lib/ai/provider";
import { KNOWLEDGE_TOPICS, type TopicId } from "@/lib/knowledge/generated";

/** RPC calls in this module abort after this long rather than stalling the request indefinitely. */
const RPC_TIMEOUT_MS = 5000;

/**
 * Cosine-similarity threshold for match_knowledge_embedding (CLAUDE.md
 * Section 9, Step 2). Empirically calibrated against real production data
 * via scripts/debug-similarity.ts, not a blind guess — an earlier 0.75
 * default turned out to be unreachable in practice and was replaced.
 *
 * Two real reference points against the deployed knowledge_embeddings
 * (openai/text-embedding-3-small, whole-document embeddings):
 *   - "How do you measure how AI-ready a company is?" (a real paraphrase of
 *     the AI Maturity Index, containing none of Step 1's keyword triggers)
 *     scored 0.5578 against the correct doc, with the next-closest
 *     wrong-topic doc at 0.4949 — a ~0.06 gap.
 *   - "Can you help me file my taxes?" (the OUT_OF_SCOPE evaluation fixture
 *     case) topped out at 0.0726 against every doc — roughly 7-8x lower
 *     than the true match above.
 * The out-of-scope margin is enormous regardless of where the threshold
 * sits in the 0.1-0.6 range, so the real tuning question is separating a
 * correct topic from a wrong-but-related one in this corpus, not from true
 * noise. 0.5 sits with margin below the one confirmed true match (room for
 * a real user's phrasing to score a bit lower than this sample) and just
 * above the highest wrong-topic score observed. A wrong-topic match within
 * this corpus is a soft failure (still-truthful Cadre content, just
 * possibly not the best-fit doc) — the hard failure this design actually
 * guards against, a confident answer to something unrelated, has the ~7-8x
 * margin above. Still just two real data points, not a full eval set —
 * revisit with more real traffic.
 */
export const SIMILARITY_THRESHOLD = 0.5;

interface MatchRow {
  topic_id: string;
  similarity: number;
}

/**
 * Step 2 semantic fallback (CLAUDE.md Section 9) — only called when Step 1's
 * selectTopics() returns no match for a KNOWLEDGE-intent message. Never
 * throws: any embedding or query failure, timeout, or unrecognized topic_id
 * degrades to "no match" so the caller falls through to escalation, the same
 * fail-safe direction as every other uncertainty path in this app.
 *
 * `supabase` has no default — it must be passed explicitly. A bare default
 * parameter would be evaluated (and could throw on missing env config)
 * before this function's own try/catch ever runs, which would contradict
 * the never-throws guarantee above.
 */
export async function semanticFallback(
  message: string,
  embeddingProvider: EmbeddingProvider,
  supabase: SupabaseClient,
): Promise<TopicId | null> {
  try {
    const embedding = await embeddingProvider.embed(message);
    const { data, error } = await supabase
      .rpc("match_knowledge_embedding", {
        query_embedding: embedding,
        match_threshold: SIMILARITY_THRESHOLD,
        match_count: 1,
      })
      .abortSignal(AbortSignal.timeout(RPC_TIMEOUT_MS));

    if (error) {
      console.error("semanticFallback: RPC failed", error);
      return null;
    }

    const rows = (data ?? []) as MatchRow[];
    const candidate = rows[0]?.topic_id;
    if (!candidate || !(candidate in KNOWLEDGE_TOPICS)) {
      if (candidate) {
        console.error("semanticFallback: RPC returned unknown topic_id", candidate);
      }
      return null;
    }
    return candidate as TopicId;
  } catch (error) {
    console.error("semanticFallback: embed/query failed", error);
    return null;
  }
}
