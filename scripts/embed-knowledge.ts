// Manual, one-off (re-)embedding of knowledge/*.md into knowledge_embeddings
// (CLAUDE.md Section 9, Step 2). Never wired into prebuild/CI — run by hand
// whenever knowledge content changes: `npm run embed:knowledge`.
import { OpenRouterEmbeddingProvider } from "@/lib/ai/openrouter";
import { KNOWLEDGE_TOPICS } from "@/lib/knowledge/generated";
import { createServiceClient } from "@/lib/supabase/serviceClient";

async function main() {
  if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
    console.error(
      "Refusing to run with NODE_ENV=production without --force. " +
        "This writes real rows to whatever Supabase project NEXT_PUBLIC_SUPABASE_URL points at.",
    );
    process.exit(1);
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_EMBEDDING_MODEL;
  if (!apiKey || !model) {
    console.error("OPENROUTER_API_KEY and OPENROUTER_EMBEDDING_MODEL must be set.");
    process.exit(1);
  }

  console.log(`Target Supabase project: ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(not set)"}`);
  console.log(`Embedding model: ${model}`);

  const embeddingProvider = new OpenRouterEmbeddingProvider(apiKey, model);
  const supabase = createServiceClient();

  const topicIds = Object.keys(KNOWLEDGE_TOPICS) as Array<keyof typeof KNOWLEDGE_TOPICS>;
  for (const topicId of topicIds) {
    const { content } = KNOWLEDGE_TOPICS[topicId];
    process.stdout.write(`Embedding ${topicId}... `);
    const embedding = await embeddingProvider.embed(content);
    const { error } = await supabase
      .from("knowledge_embeddings")
      .upsert({ topic_id: topicId, embedding, content, updated_at: new Date().toISOString() });
    if (error) {
      console.log("FAILED");
      throw error;
    }
    console.log("ok");
  }

  console.log(`Done — ${topicIds.length} topics embedded.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
