-- Semantic fallback storage (CLAUDE.md Section 9, Step 2 / PLAN.md Phase 7 Step 2).

create extension if not exists vector;

create table if not exists knowledge_embeddings (
  topic_id text primary key,
  embedding vector(1536) not null,
  content text not null,
  updated_at timestamptz not null default now()
);

alter table knowledge_embeddings enable row level security;

create or replace function match_knowledge_embedding(
  query_embedding vector(1536),
  match_threshold float,
  match_count int default 1
)
returns table (topic_id text, similarity float)
language sql stable
as $$
  select
    knowledge_embeddings.topic_id,
    1 - (knowledge_embeddings.embedding <=> query_embedding) as similarity
  from knowledge_embeddings
  where 1 - (knowledge_embeddings.embedding <=> query_embedding) > match_threshold
  order by knowledge_embeddings.embedding <=> query_embedding asc
  limit match_count;
$$;
