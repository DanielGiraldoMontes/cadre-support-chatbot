-- Cadre AI support chatbot — initial schema (CLAUDE.md Section 16 / PLAN.md Phase 2).

create table if not exists conversations (
  id uuid primary key,
  created_at timestamptz not null default now(),
  last_message_at timestamptz
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  intent text,
  matched_topic text,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_created_at_idx
  on messages (conversation_id, created_at);

create table if not exists escalations (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  message_id uuid references messages(id) on delete set null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null default 1
);

alter table conversations enable row level security;
alter table messages enable row level security;
alter table escalations enable row level security;
alter table rate_limits enable row level security;
