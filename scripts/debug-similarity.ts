// Throwaway diagnostic — NOT part of the shipped app. Prints real cosine
// similarity for a test message against every knowledge_embeddings row,
// bypassing the match_threshold filter, so we can see actual scores instead
// of just "match or no match". Run: tsx --env-file=.env.local scripts/debug-similarity.ts "your question"
import { OpenRouterEmbeddingProvider } from "@/lib/ai/openrouter";
import { createServiceClient } from "@/lib/supabase/serviceClient";

async function main() {
  const message = process.argv[2];
  if (!message) {
    console.error('Usage: tsx --env-file=.env.local scripts/debug-similarity.ts "your question"');
    process.exit(1);
  }

  const apiKey = process.env.OPENROUTER_API_KEY!;
  const model = process.env.OPENROUTER_EMBEDDING_MODEL!;
  const embeddingProvider = new OpenRouterEmbeddingProvider(apiKey, model);
  const supabase = createServiceClient();

  const embedding = await embeddingProvider.embed(message);
  console.log(`Embedded "${message}" (${embedding.length} dims)\n`);

  const { data, error } = await supabase.rpc("match_knowledge_embedding", {
    query_embedding: embedding,
    match_threshold: -1, // bypass the filter entirely — show everything
    match_count: 9,
  });

  if (error) {
    console.error("RPC error:", error);
    process.exit(1);
  }

  console.log("topic_id".padEnd(20), "similarity");
  for (const row of data as { topic_id: string; similarity: number }[]) {
    console.log(row.topic_id.padEnd(20), row.similarity.toFixed(4));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
