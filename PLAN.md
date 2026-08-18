# Cadre AI Chatbot — Execution Plan

## 0. Mission

Build and ship a polished customer-support chatbot for Cadre AI within the take-home window.

The plan is deliberately sequential and conservative.

The main objective is to reach a stable, deployed P0 before spending time on optional AI sophistication.

`CLAUDE.md` and `PLAN.md` already exist at the project root as the fixed baseline documents. Phase 0 does not create them — it scaffolds the project around them. Only edit them later for a durable rule change or to mark phase completion (see Phase 18), never as a running log.

---

# 1. Final Scope

## P0 — Required

- Chat UI
- Cadre knowledge answers
- Intent routing
- Booking guidance
- Client portal guidance
- Unsupported-request handling
- Escalation behavior
- OpenRouter production chatbot provider
- Rate limiting on the chat endpoint
- Supabase persistence where useful
- Tests
- GitHub CI
- Firebase App Hosting deployment

## P1 — Add only after P0 is green

- stronger conversation persistence
- escalation persistence
- evaluation fixture
- prompt-injection tests
- UI polish

## P2 — Optional

- ~~semantic fallback for knowledge lookup~~ — **done**, see Phase 7 Step 2 (pgvector, only when deterministic lookup misses, built after P0 and all of P1 were solid)
- AI Maturity Index mini-assessment
- streaming
- suggested prompts — **done**, see `components/chat/StarterPrompts.tsx`
- lightweight analytics — largely already covered by `messages.intent`/`messages.matched_topic` persisted per turn; a dedicated dashboard is explicitly out of scope (Section 2)

P2 is expendable.

Never sacrifice deployment, correctness, or P0 to finish P2. This directly follows "cut scope aggressively — 3 working features beat 8 broken ones": the deterministic keyword/topic lookup alone is a complete, defensible, fully-tested answer to "Cadre knowledge answers" in P0. The semantic fallback improves recall on paraphrased edge cases; it does not fix anything broken. Move it below P1 items that harden or verify what's already shipping (persistence resilience, prompt-injection tests, the evaluation fixture) — those protect P0's correctness, which matters more than RAG-as-a-feature for the review.

---

# 2. Architecture Target

```text
Next.js
   │
   ├── Chat UI
   │
   └── /api/chat
          │
          ▼
    Rate limit check
          │
          ▼
    AI Orchestrator
          │
          ├── Intent Router
          ├── Deterministic Topic Lookup  (knowledge/*.md → generated.ts, P0)
          ├── Semantic Fallback  (OpenRouter /embeddings, implemented — only on no match, KNOWLEDGE intent only)
          ├── Business Flows
          └── Escalation
                  │
                  ▼
             OpenRouter
        (chat/completions + embeddings — the only LLM/embedding
         dependency anywhere in the deployed app)
```

Supabase:

```text
conversations
messages
escalations
rate_limits
knowledge_embeddings   (topic_id, embedding vector(1536), content, updated_at — Step 2 semantic fallback)
```

Vector usage is scoped to the semantic fallback only — see Phase 7. It uses OpenRouter's `/embeddings` endpoint, not a second provider.

---

# 3. Phase 0 — Repository Foundation

## Objective

Scaffold the project inside the existing infrastructure and establish deployment immediately.

## Preconditions (already done — do not recreate)

- GitHub repository already created (`CLAUDE.md`, `PLAN.md`, and the nine `knowledge/*.md` files already committed at root)
- Firebase project already created
- Firebase App Hosting backend already created
- Supabase project already created

Phase 0 connects to these, it does not create them. If any credential or ID (Firebase project ID, App Hosting backend ID, Supabase URL/keys) is missing from `.env.example` / repo secrets, treat that as a blocking question, not something to invent or skip.

## Tasks

- [ ] Clone the existing repository
- [ ] Create Next.js App Router project in the repo root
- [ ] Enable strict TypeScript
- [ ] Configure Tailwind CSS
- [ ] Configure ESLint
- [ ] Add test framework
- [ ] Create `.env.example` (Supabase + OpenRouter variable names only, no values)
- [ ] Create initial README
- [ ] Confirm the existing Firebase App Hosting backend is connected to this repository and live branch (`main`)
- [ ] (you, not Claude Code — see CLAUDE.md Section 28) Review the scaffold and push it to `main`
- [ ] Verify the existing public Firebase App Hosting URL serves the minimal page

## Exit criteria

The repository can be cloned and the app runs locally.

The existing public Firebase App Hosting URL serves the current `main`.

---

# 4. Phase 1 — CI/CD

## Objective

Prevent broken code from reaching the live deployment.

## Decision (firm — do not leave this ambiguous)

App Hosting's default "auto-rollout on every push to the live branch" is **turned off** for this project. A rollout only happens after `validate` passes, triggered explicitly from GitHub Actions using the Firebase CLI against the existing backend. This is the literal reading of "deploy only after validation passes" — relying on branch protection alone with auto-rollout still enabled is an acceptable fallback (see below) if time runs short, but the explicit-trigger version is the target.

## Tasks

Create a single workflow:

```text
.github/workflows/ci-deploy.yml
```

with two jobs:

```text
validate (runs on: push to main, and on pull_request)
  npm ci
  → lint
  → typecheck
  → test
  → build

deploy (runs on: push to main only; needs: validate)
  → firebase apphosting:rollouts:create $FIREBASE_BACKEND_ID
      --project $FIREBASE_PROJECT_ID
      --git-branch main
```

- [ ] In the Firebase console, disable automatic rollouts on the existing App Hosting backend (Settings → Deployment)
- [ ] Add repo secrets/variables: `FIREBASE_PROJECT_ID`, `FIREBASE_BACKEND_ID`, `FIREBASE_REGION`
- [ ] Auth for the `deploy` job — prefer Workload Identity Federation (GitHub OIDC → a scoped GCP service account, no stored key). If WIF setup would eat too much of the time budget, fall back to a service-account key stored as an encrypted GitHub secret (never committed to the repo).
- [ ] Add branch protection on `main`: `validate` is a required status check before merge
- [ ] Ask the developer to push a small test commit (you don't create it — see CLAUDE.md Section 28) and confirm it only reaches production after `validate` is green

## Exit criteria

When the developer pushes a test commit, it can:

1. run `validate` on the PR
2. block merge if `validate` fails
3. on merge to `main`, trigger `deploy`, which rolls out the exact commit that passed
4. appear live on the existing Firebase App Hosting URL

---

# 5. Phase 2 — Supabase Foundation

## Objective

Create the smallest useful persistence layer.

## Session identity (firm decision)

No user accounts. A `conversationId` (UUID) is generated client-side on first mount if `localStorage` has none, persisted there, and sent with every `/api/chat` request. The server upserts the `conversations` row on first sight of a given id and appends to `messages` from then on. This is a **different key** from the rate-limit key (IP) — `conversationId` is trivially resettable by the client and must never be trusted for abuse prevention, only for continuity/UX. See Section 9-style separation in `CLAUDE.md` Section 15.

## Schema (concrete, not just table names)

```text
conversations
  id              uuid primary key
  created_at      timestamptz default now()
  last_message_at timestamptz

messages
  id              uuid primary key default gen_random_uuid()
  conversation_id uuid references conversations(id)
  role            text check (role in ('user','assistant'))
  content         text
  intent          text          -- nullable; set after classification, user messages only
  matched_topic   text          -- nullable; which knowledge topic grounded this assistant reply, if any
  created_at      timestamptz default now()

escalations
  id              uuid primary key default gen_random_uuid()
  conversation_id uuid references conversations(id)
  message_id      uuid references messages(id)
  reason          text
  created_at      timestamptz default now()

rate_limits
  key             text primary key   -- IP, not conversationId — see above
  window_start    timestamptz
  count           int
```

## Tasks

- [ ] Link the existing Supabase project (URL + anon/publishable key into `.env.example` and local `.env`)
- [ ] Add `@supabase/supabase-js`
- [ ] Add `@supabase/ssr`
- [ ] Create `lib/supabase/client.ts`
- [ ] Create `lib/supabase/server.ts`
- [ ] Create migrations for the four tables above
- [ ] Implement client-side `conversationId` generation + `localStorage` persistence
- [ ] Implement server-side upsert-on-first-sight for `conversations`
- [ ] Verify local DB read/write

## Exit criteria

Server and browser Supabase clients work correctly.

No service-role credentials are exposed to browser code.

Database changes are represented by migrations.

Reloading the chat page recovers the same conversation via the `conversationId` in `localStorage`.

---

# 6. Phase 3 — UI Shell

## Objective

Build the minimum polished chatbot interface before adding complex AI logic.

## Tasks

- [ ] Main page
- [ ] Chat container
- [ ] Message list
- [ ] Message composer
- [ ] Loading state
- [ ] Empty state
- [ ] Error state
- [ ] Mobile layout
- [ ] Suggested starter prompts

Starter prompts should correspond to actual supported capabilities.

Example:

```text
What does Cadre AI do?
Do you work with my industry?
What is the AI Maturity Index?
How can I get started?
```

## Exit criteria

The UI works with a mocked assistant response.

No real LLM call is needed yet.

---

# 7. Phase 4 — OpenRouter Provider

## Objective

Create the production AI provider.

## Tasks

- [ ] Create provider interface
- [ ] Create OpenRouter implementation
- [ ] Add server-only configuration
- [ ] Add model configuration
- [ ] Add timeout handling
- [ ] Add error handling
- [ ] Validate response shape
- [ ] Add development mock provider (concrete, see below)

## Development mock provider (concrete)

- [ ] `lib/ai/mockProvider.ts` implementing the same `LLMProvider` interface, returning fixed/canned responses with no network call
- [ ] Toggle via `USE_MOCK_LLM=true` in local `.env` (never set in Firebase secrets/production)
- [ ] Wire the toggle where the provider is constructed, not scattered through the orchestrator

This is what lets manual end-to-end testing (clicking through the actual chat UI, checking routing/persistence/rate-limiting) happen for free, as many times as needed, without spending OpenRouter budget.

## Three separate testing loops — don't conflate them

1. **Automated unit tests** — always mocked provider responses, zero cost, run in CI. (Phase 14)
2. **Manual end-to-end smoke testing** (does the UI/routing/persistence actually work together) — use `USE_MOCK_LLM=true` above. Free, repeatable, tests the real code path minus the real model call.
3. **Prompt content iteration** (does the wording/tone/classification quality feel right) — use the mock provider for quick app checks and the deployed OpenRouter-backed app for final verification.

Important:

The Cadre-provided OpenRouter key is only for the chatbot.

Do not use it for coding assistance.

Avoid wasting it on repeated manual testing when mocks are sufficient — that's exactly what loop 2 above is for.

## Exit criteria

A single server-side OpenRouter request works through the provider abstraction.

`USE_MOCK_LLM=true` lets the full app run locally with zero real API calls.

---

# 8. Phase 5 — AI Orchestrator

## Objective

Separate application routing from response generation.

## Tasks

Create:

```text
lib/ai/orchestrator.ts
lib/ai/prompts.ts
lib/ai/schemas.ts
lib/business/intents.ts
lib/api/rateLimit.ts
```

Implement:

```text
message
→ rate limit check (see below)
→ validate
→ classify intent
→ route
→ respond
```

Initial intents:

```text
KNOWLEDGE
BOOK_CALL
CLIENT_PORTAL
PRICING
ESCALATION
UNKNOWN
```

## Rate limiting (decision — not auth)

This is a public support chatbot; prospective clients should never have to log in to ask a question, so **do not add user authentication**. But every message costs real OpenRouter budget, and the budget is explicitly limited — an unauthenticated endpoint with no cap is an open invitation to burn it, by accident (a retry loop) or on purpose.

- [ ] Add IP-based (or session-id-based, whichever is simpler given the deployment target) rate limiting on `/api/chat` — a small Supabase table (`rate_limits: key, window_start, count`) or an in-memory counter is enough for a take-home; do not reach for a dedicated service (Upstash, Cloudflare, etc.) unless one is already trivially available
- [ ] Cap: something conservative and clearly stated in code, e.g. 20 messages/hour per IP — the exact number matters less than having an enforced, testable ceiling
- [ ] Return a friendly UI state on 429, not a raw error
- [ ] Unit test: Nth+1 request within the window is rejected

## Exit criteria

All intent decisions are structured, validated, and testable.

Rate limiting is enforced and unit tested; the endpoint cannot be trivially used to exhaust the OpenRouter budget.

---

# 9. Phase 6 — Knowledge Base

## Objective

Wire up the already-written business source of truth. **The content itself is already done — do not rewrite, re-research, or re-author it.**

## Precondition (already done — do not recreate)

`knowledge/*.md` already exists at the repo root, committed alongside `CLAUDE.md` and `PLAN.md`, with real content sourced from the take-home brief and cadreai.com:

```text
knowledge/
  about-cadre.md
  services.md
  industries.md
  ai-maturity-index.md
  llm-selection.md
  security.md
  portal.md
  getting-started.md
  pricing.md
```

Each file already states its own explicit knowledge gaps (an "If asked something not covered here" section) — those are deliberate, not omissions to fill in. Do not add facts to these files that aren't already there; if a scenario needs a fact none of the files have, that's a signal to route to escalation, not to invent content here.

## Tasks

This phase is now "read and wire," not "author":

- [ ] Read all nine `knowledge/*.md` files
- [ ] Confirm the `TopicId` union (Phase 6 build step below) matches these nine filenames exactly
- [ ] Confirm the `INDUSTRIES` const array (used in Phase 7 Step 1) matches the list in `industries.md` exactly — copy it, don't re-derive it
- [ ] Confirm the topic → trigger-terms map (Phase 7 Step 1) has reasonable coverage for each file's likely questions (e.g. `pricing.md` should be reachable from "how much," "cost," "budget," not just the word "pricing")

## How the knowledge files are actually read (firm decision)

`knowledge/*.md` is the human-edited source of truth — easy to review and diff in a PR. It is **not** read from disk at request time. A build step compiles it into a statically-imported TypeScript module so the orchestrator never touches the filesystem in the serving path (Next.js output tracing on Firebase App Hosting/Cloud Run does not reliably bundle arbitrary files read via dynamic `fs` calls — static imports avoid that failure mode entirely).

```text
knowledge/*.md  (already written)
      │  npm run build:knowledge  (part of "prebuild")
      ▼
lib/knowledge/generated.ts
      │  exports KNOWLEDGE_TOPICS: Record<TopicId, { title: string; content: string }>
      ▼
lib/ai/orchestrator.ts  (imports the generated module directly)
```

- [ ] Write `scripts/build-knowledge.ts` — reads every file in `knowledge/`, emits `lib/knowledge/generated.ts`
- [ ] Add `build:knowledge` to `package.json`, wire it into `prebuild`
- [ ] Define `TopicId` as a closed union matching the nine filenames above — no open-ended string keys
- [ ] Define the finite `INDUSTRIES` list as a typed const array, copied verbatim from `industries.md`: `["Professional Services", "Private Equity", "Real Estate", "Financial Services", "Mortgage & Lending", "Construction", "Retail & E-commerce", "Manufacturing & Logistics", "Hospitality"]`
- [ ] Do not add `lib/knowledge/generated.ts` to `.gitignore` — leave it trackable so `npm run build` stays reproducible without a separate generation step in CI (the developer commits it — see CLAUDE.md Section 28)

## Exit criteria

Known challenge scenarios can be answered without relying on unsupported model knowledge.

`lib/knowledge/generated.ts` exists and is imported by the orchestrator with no runtime `fs` access.


---

# 10. Phase 7 — Knowledge Lookup: Deterministic-First, Semantic Stretch

## Decision (revised, firm)

**Step 1 alone is a complete, shippable answer to "Cadre knowledge answers."** It is P0. Full stop — the chatbot works, is fully tested, and is fully explainable in the review without Step 2 existing at all.

Step 2 (semantic fallback) is **P2/stretch** — designed and ready to build, but only *after* P0 is solid and every P1 item (persistence hardening, escalation persistence, evaluation fixture, prompt-injection tests, UI polish) is done. This follows the brief's own scope guidance directly: "cut scope aggressively — 3 working features beat 8 broken ones." A half-wired semantic fallback is worse than no semantic fallback; a rock-solid deterministic layer plus a documented "here's what I'd add next" is a stronger review story than a fragile stretch feature.

Pure vector RAG as the *primary, only* mechanism was never the right call for ~9 finite, hand-curated documents — it would add latency and a required external API dependency to every single message to solve a scale/ambiguity problem this project doesn't have, and it isn't meaningfully simpler to build than the keyword layer. It trades a few `if` statements for an embeddings pipeline, a similarity threshold to tune, and non-obvious test fixtures. Simpler stays simpler.

```text
message (intent = KNOWLEDGE)
  ↓
1. Deterministic topic lookup (keyword/industry match, zero extra latency) — P0, ships regardless
   ├─ match found → use it, done
   └─ no match → escalate  (P0 behavior — stops here unless Step 2 is built)
        │
        └─ P2/stretch only: try Step 2 semantic fallback before escalating
```

## Step 1 — Deterministic topic lookup (P0 — this is what actually ships)

```text
1. exact/substring match against the finite INDUSTRIES list → industries.md
2. keyword match against a small fixed map of topic → trigger terms, e.g.
   { "ai-maturity-index": ["maturity index", "score", "assessment", "eight-pillar"],
     "llm-selection":     ["which model", "llm selection", "gpt vs claude", "model choice"],
     "security":          ["data security", "encryption", "privacy", "confidential"],
     "services":          ["what do you do", "services", "offer"] }
3. default → about-cadre.md + services.md
```

- [ ] Define the topic → trigger-terms map as a typed constant (`lib/business/topicRouting.ts`)
- [ ] Implement `selectTopics(message, intent): TopicId[]`
- [ ] Unit test: each representative question in the demo script (Phase 23) resolves to the expected topic(s)
- [ ] Unit test: an out-of-scope question resolves to zero topics → escalate

## Exit criteria for P0

Every representative knowledge question in the demo script resolves to the correct topic via Step 1 alone, verified by test.

Out-of-scope/unmatched questions escalate cleanly — no invented context, no dependency on Step 2 existing.

---

## Step 2 — Semantic fallback (implemented, after P0 + all of P1 were done)

Built only once Phase 1 through Phase 14 (Testing) were green, per the original P2/stretch gate below.

## Embedding provider (firm decision — OpenRouter only)

OpenRouter has a standard `/embeddings` endpoint (OpenAI-compatible request/response shape, same `OPENROUTER_API_KEY` already used for chat). This keeps the entire deployed app on the one provider the challenge actually supplies, with zero extra credentials to manage.

Locked-in choice: `openai/text-embedding-3-small` via `POST https://openrouter.ai/api/v1/embeddings`, body `{ "model": "openai/text-embedding-3-small", "input": "..." }`, response `data[0].embedding` — **1536 dimensions**. This is OpenAI's small/cost-effective embedding model, priced low enough that embedding 9 short documents once is negligible cost, and it's the most widely used embedding model on OpenRouter as of this writing. If it's ever unavailable at implementation time, the fallback is any other OpenRouter embedding model — just update the dimension in the migration to match; don't silently assume 1536 for a different model.

### Why document-level embeddings, not chunking

Each `knowledge/*.md` file is short (a few hundred words). Embed the whole document, not paragraph-level chunks — chunking is a solution to a problem (documents too large for one embedding / one context window) that doesn't exist at this size, and skipping it removes a whole layer of chunking-boundary bugs.

### Tasks (done — deviations from the original sketch noted)

- [x] `create extension if not exists vector;` (`supabase/migrations/0002_knowledge_embeddings.sql`)
- [x] Migration: `knowledge_embeddings(topic_id text primary key, embedding vector(1536), content text, updated_at timestamptz)`, RLS enabled, no index (9 rows — a sequential scan is exact and free; deferred until the corpus is large enough to earn an ivfflat/hnsw index)
- [x] `scripts/embed-knowledge.ts` — embeds each `knowledge/*.md` file once via `openai/text-embedding-3-small` through OpenRouter's `/embeddings` endpoint, upserts into `knowledge_embeddings`. Manual only (`npm run embed:knowledge`), never wired into `prebuild` or CI. Refuses to run under `NODE_ENV=production` without `--force`, and prints the target Supabase URL before writing.
- [x] `lib/knowledge/semanticFallback.ts` — embeds the incoming message, calls a `match_knowledge_embedding` Postgres RPC function (not a raw `ORDER BY` — supabase-js can't bind a vector literal into `.order()` cleanly) with `match_threshold = 0.5`, empirically calibrated against real production data (an initial `0.75` guess was unreachable in practice — see `CLAUDE.md` Section 9 and `scripts/debug-similarity.ts`). Never throws; every failure (embed error, RPC error, no rows above threshold) returns `null`.
- [x] Unit tests (`tests/semanticFallback.test.ts`) with a mocked embedding provider and a stubbed Supabase `.rpc()` — hit, miss, and error paths. No real API calls.
- [x] Wired into the orchestrator: only called when intent is `KNOWLEDGE` and Step 1's `selectTopics()` returns empty. Dependencies (`embeddingProvider`, `supabase`) are constructed lazily inside that branch, not as bare parameter defaults — so every pre-existing `runOrchestrator()` call site (tests and the route handler) needed zero changes.

### Exit criteria for P2 — met

A representative paraphrased question that the keyword layer misses ("How do you measure how AI-ready a company is?" instead of "AI Maturity Index") resolves correctly via the semantic fallback, verified by test with a mocked embedding response (`tests/orchestrator.test.ts`).

Unknown/out-of-scope questions still fall through to escalation, not invented context — unchanged, and covered by the pre-existing evaluation fixture.

### Known deviation / follow-up

`messages.matched_topic` doesn't record which layer (Step 1 vs Step 2) produced a match, so there's currently no way to tell from persisted data how often the fallback fires. Noted as a stated gap, not a silent one — a `console.log` of `{intent, matchedTopic, source, similarity}` in the orchestrator would close it cheaply without a schema change.

---

# 11. Phase 8 — Grounded Response Generation

## Objective

Make the final answer trustworthy.

## Tasks

System prompt must define:

- role
- audience
- scope
- grounding rules
- escalation
- injection resistance
- response style

The application supplies the matched topic content (from Phase 7's deterministic lookup) separately — the model never fetches or searches for it itself.

## Request assembly (concrete — this is conversational memory, distinct from grounding)

Every call to the LLM provider sends, in order:

```text
1. system prompt          (behavior rules — CLAUDE.md Section 10)
2. matched knowledge topic content   (Phase 7 — business facts for THIS turn)
3. conversation history   (this conversation's prior messages — see cap below)
4. the new user message
```

History comes from `messages` for the current `conversationId` (Phase 2), ordered by `created_at`, mapped to `{role, content}`.

- [ ] Cap history sent to the LLM at the last 20 messages (10 turns) — bound token growth, don't let a long conversation grow the request unbounded
- [ ] Topic matching (Phase 7 Step 1) considers the new message **plus the last 1-2 user messages**, not the new message in isolation — a bare follow-up ("and construction?") must still resolve correctly using what was asked before it
- [ ] Unit test: a follow-up question with no topic keywords of its own still resolves via the preceding message's context

## Response policy

```text
Enough context
→ answer

Insufficient context
→ limitation + redirect/escalation
```

## Exit criteria

The assistant reliably refuses to invent unsupported Cadre facts.

---

# 12. Phase 9 — Booking Flow

## Objective

Handle strategy-call requests.

## Tasks

- [ ] Detect booking intent
- [ ] Return verified booking information
- [ ] Provide CTA/link only if officially available
- [ ] Escalate if the booking mechanism is unavailable

Do not invent URLs.

## Exit criteria

A booking request produces an intentional, verified next step.

---

# 13. Phase 10 — Client Portal Flow

## Objective

Handle portal questions without pretending to access the portal.

## Tasks

- [ ] Detect portal intent
- [ ] Return approved access instructions
- [ ] Explain limitations
- [ ] Escalate for account-specific problems

## Exit criteria

The chatbot never claims it can log into or inspect a client's portal.

---

# 14. Phase 11 — Escalation

## Objective

Turn uncertainty into an explicit product behavior.

## Trigger cases

- unsupported question
- missing knowledge
- client-specific request
- unavailable capability
- unsafe/ambiguous request

## Tasks

- [ ] Define escalation reasons
- [ ] Create user-facing escalation state
- [ ] Persist escalation if useful
- [ ] Add tests

## Exit criteria

Unknown questions never hallucinate.

---

# 15. Phase 12 — Conversation Persistence Hardening (P1)

## Objective

The core mechanism (create conversation, store messages, recover session via `conversationId`) is already fully specified as P0 in Phase 2 — this phase is about hardening it, not building it from scratch.

## Tasks

- [ ] Persistence writes must not block the response: if a Supabase write fails, the user still gets their answer; log the failure, don't error out the chat
- [ ] Decide what happens once a conversation exceeds Phase 8's 20-message context cap — for this project, simple truncation (send only the most recent 20) is enough; summarizing older turns into a rolling summary is a documented idea for "what I'd do with more time," not something to build now
- [ ] Confirm `last_message_at` on `conversations` updates on each new message (useful if a "recent conversations" admin view is ever added — not needed for P0)

Do not add user accounts. Do not build multi-device sync — a `conversationId` in `localStorage` is inherently single-browser, and that's an acceptable, stated limitation.

## Exit criteria

A Supabase write failure degrades gracefully instead of breaking the chat.

---

# 16. Phase 14 — Testing

## Objective

Verify deterministic behavior cheaply and repeatedly.

## Tasks

### Unit tests

- [ ] Intent schema
- [ ] routing
- [ ] escalation
- [ ] provider failure handling
- [ ] topic lookup — Step 1 deterministic (P0 — always required)
- [ ] semantic fallback — Step 2, with a mocked embedding client (only if Step 2 was built — see Phase 7)
- [ ] rate limiting
- [ ] input validation

### Integration tests

- [ ] chat API
- [ ] Supabase persistence
- [ ] provider mock

### AI evaluation fixture

Create examples for:

```text
KNOWN_FACT
INDUSTRY
SERVICE
BOOKING
PORTAL
MATURITY
SECURITY
PRICING
OUT_OF_SCOPE
PROMPT_INJECTION
AMBIGUOUS
```

Do not require exact natural-language output.

Assert expected behavior.

## Exit criteria

Tests can run without paid LLM calls.

---

# 18. Phase 15 — Security Review

## Checklist

- [ ] no secrets in git history
- [ ] OpenRouter key server-only
- [ ] no extra AI provider variables or imports anywhere in the repo beyond OpenRouter
- [ ] no service-role key in client bundle
- [ ] user input validated
- [ ] LLM output validated
- [ ] prompt injection tested
- [ ] errors do not leak secrets
- [ ] environment variables documented

## Exit criteria

No obvious credential or trust-boundary issue remains.

---

# 19. Phase 16 — UI Polish

Only after all core flows work.

Improve:

- [ ] spacing
- [ ] typography
- [ ] message hierarchy
- [ ] loading treatment
- [ ] error treatment
- [ ] escalation UI
- [ ] responsive behavior
- [ ] accessibility

Avoid spending more time on styling than on reliability.

---

# 20. Phase 17 — AI Maturity Index Mini-Assessment

Optional.

Only implement if:

- P0 is stable
- P1 is stable
- deployment is stable
- testing is stable

Possible flow:

```text
Explain AI Maturity Index
        ↓
Offer quick assessment
        ↓
3–5 questions
        ↓
Simple indicative result
        ↓
Recommended next step
```

Do not represent the result as an official Cadre assessment unless the project provides enough verified methodology to justify that claim.

Prefer "indicative" or "prototype" framing when appropriate.

---

# 21. Phase 18 — Final Documentation

Update:

### README

Must explain:

- project purpose
- architecture
- local setup
- environment variables
- testing
- deployment
- design decisions
- known limitations

### PLAN.md

Mark completed phases and record meaningful deviations.

### CLAUDE.md

Only update when a durable project rule changes.

Do not turn either file into a chronological diary.

---

# 22. Phase 19 — Final Deployment Verification

Before submission:

```text
[ ] Public URL loads
[ ] Chat starts
[ ] Knowledge scenario works
[ ] Industry scenario works
[ ] Booking flow works
[ ] Portal flow works
[ ] Unknown question escalates
[ ] Prompt injection does not override policy
[ ] Supabase persistence works
[ ] Production environment variables work
[ ] CI passes
[ ] Production build passes
[ ] Firebase rollout succeeds
[ ] Git repository is clean
[ ] No secrets are committed
```

---

# 23. Recommended Demo Script

## Demo 1

"What does Cadre AI do?"

Expected:

Grounded answer.

## Demo 2

"Do you work with construction companies?"

Expected:

Industry-specific grounded response.

## Demo 3

"I'd like to speak with an AI strategist."

Expected:

Booking routing.

## Demo 4

"How do I access the client portal?"

Expected:

Verified portal guidance.

## Demo 5

Ask an unsupported question.

Expected:

Clear limitation + escalation/redirect.

## Demo 6

Attempt prompt injection.

Expected:

System boundaries remain intact.

---

# 24. Scope Kill Switch

At any point, if time is running short:

STOP adding features.

The fallback submission must still contain:

```text
Chat UI
+
OpenRouter
+
Rate limiting
+
Intent routing
+
Grounded knowledge (deterministic lookup only — the semantic fallback is P2/stretch and expendable by design, not an afterthought)
+
Escalation
+
Tests
+
CI
+
Firebase deployment
```

Everything else is optional.

---

# 25. Final Success Definition

The project is successful when a reviewer can say:

> Daniel took an ambiguous AI product brief, defined a focused scope, built a grounded AI system, used AI-assisted development deliberately, verified generated code, handled uncertainty correctly, and shipped it reliably.

The implementation should make that conclusion obvious.
