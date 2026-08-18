# Cadre AI Chatbot — Claude Code Operating Manual

## 0. Mission

This repository contains the Cadre AI Staff AI Engineer take-home challenge.

Build a polished, production-oriented MVP customer-support chatbot that demonstrates:

- clear product scoping
- reliable AI orchestration
- grounded answers
- explicit uncertainty and escalation
- clean Next.js + Supabase architecture
- secure provider integrations
- automated verification
- controlled CI/CD deployment
- effective AI-assisted engineering

This is a **time-boxed take-home**, not a platform rebuild.

Optimize for:

1. Correctness
2. Reliability
3. Architectural clarity
4. AI grounding and safe behavior
5. Good UX
6. Verification
7. Speed
8. Optional features

Never optimize for feature count.

## Hard boundary — read this before touching git

Claude Code never runs `git commit`, `git push`, or opens a pull request, ever, for any reason, including a task that looks finished. The developer reviews and commits everything manually. Full detail in Section 28. This is repeated here because it's the one rule most likely to get skipped by habit.

---

# 1. Challenge Constraints

The official challenge expects:

- a public deployed chatbot
- a GitHub repository
- `CLAUDE.md`
- `PLAN.md`
- architecture and system-prompt discussion
- explanation of AI-assisted development
- explicit scope/trade-off decisions

Cadre's evaluation emphasizes:

- Claude Code / AI-assisted development
- system design and architecture
- development speed and scope
- code quality and verification
- communication and reasoning

The implementation should make those qualities easy to demonstrate during the live review.

---

# 2. Critical Scope Boundary

## P0 — Must work

1. Responsive chatbot UI
2. Cadre knowledge answers
3. Intent routing
4. Booking guidance
5. Client portal guidance
6. Unknown / unsupported request handling
7. Human escalation behavior
8. OpenRouter integration
9. Rate limiting on the chat endpoint (no user auth — see Section 15)
10. Supabase persistence where useful
11. Automated tests
12. GitHub CI
13. Firebase App Hosting deployment

## P1 — Add after P0 is stable

1. Better conversation persistence
2. Escalation persistence
3. Small evaluation dataset
4. Prompt-injection tests
5. UI polish

## P2 — Only if time remains

1. Semantic fallback for knowledge lookup (pgvector + OpenRouter embeddings, only when the deterministic lookup finds no match — fully designed in Section 9/PLAN.md Phase 7, build only after P0 and every P1 item are done)
2. AI Maturity Index mini-assessment
3. Streaming responses
4. Suggested prompts
5. Lightweight analytics

Full RAG (chunking + embeddings + similarity search) as the *primary, default* grounding mechanism is out of scope entirely — see Section 9. The deterministic keyword/topic lookup (P0) is a complete, fully-tested answer to "Cadre knowledge answers" on its own; the semantic layer is a P2/stretch enhancement to recall, not a fix for anything broken. This follows the brief's own guidance directly: "cut scope aggressively — 3 working features beat 8 broken ones." Don't build Section 9 Step 2 until P0 is solid and P1 is done.

Never start P1/P2 while P0 is unstable.

Do not add authentication unless it becomes necessary for an actual requirement.

Do not build an admin dashboard.

Do not build a CRM.

Do not build multi-agent orchestration.

Do not add voice, WhatsApp, email, or external calendar integrations unless explicitly justified by the brief and time remains after P0.

---

# 3. Core Product Principle

The assistant must know what it knows and know what it does not know.

The assistant must never fabricate:

- Cadre services
- industries served
- pricing
- security guarantees
- client information
- portal behavior
- case studies
- booking links
- policies
- implementation details

If approved knowledge is insufficient, escalate or redirect.

A safe limitation is better than a confident hallucination.

---

# 4. Technology Decisions

## Application

- Next.js App Router
- React
- TypeScript strict mode
- Tailwind CSS
- accessible UI
- server components by default

## Backend

- Next.js Route Handlers / Server Actions as appropriate
- Supabase PostgreSQL
- `@supabase/supabase-js`
- `@supabase/ssr`

Use Supabase browser/server utilities rather than creating clients ad hoc.

## AI

- OpenRouter for the challenge chatbot
- Model selected through configuration
- OpenRouter provider isolated behind a small interface
- Structured outputs validated before application logic consumes them

### Important API-key rule

The Cadre-provided OpenRouter key belongs exclusively to this chatbot.

Never:

- commit it
- expose it to the client
- print it
- use it for coding assistance
- place it in `NEXT_PUBLIC_*`
- place it in source files

## Development testing practice

Use the in-repo mock provider (`USE_MOCK_LLM=true`, PLAN.md Phase 4) for local and automated testing. That keeps UI, routing, persistence, and rate-limiting checks cheap and repeatable while preserving the real OpenRouter integration for the deployed app.

Do not spend the limited challenge OpenRouter budget on routine automated tests if deterministic mocks/fixtures are sufficient.

---

# 5. Model Abstraction

Keep model/provider code isolated.

Preferred shape:

```ts
interface LLMProvider {
  generateResponse(input: LLMInput): Promise<LLMResponse>;
}
```

The only implementation is `OpenRouterProvider`. There is no second provider class in this codebase, for chat or for embeddings (Section 9, Step 2 also calls OpenRouter).

Do not create a generic enterprise provider framework.

Abstraction should be minimal and useful — a single implementation still benefits from the interface, since it keeps the orchestrator decoupled from OpenRouter-specific request/response shapes.

---

# 6. AI Orchestration

The LLM is not the application.

Use this conceptual flow:

```text
User message (+ conversationId from the client — see Section 16)
    ↓
Rate limit check (by IP — a different key than conversationId, see Section 15)
    ↓
Input validation
    ↓
Load conversation history (Supabase messages for this conversationId — capped, see Section 11)
    ↓
Intent classification (considers the new message + trailing history, not the message alone)
    ↓
Application routing
    ↓
Deterministic topic lookup / business flow / escalation
    ↓
Grounded response generation (system + knowledge + history + new message)
    ↓
Output validation
    ↓
Persistence (append both messages; don't block the response on this — see PLAN.md Phase 12)
    ↓
UI
```

The LLM can recommend a classification.

Application code decides what happens next.

Do not bury business rules inside prompts when deterministic application code can enforce them.

---

# 7. Initial Intent Taxonomy

Start with:

```ts
type Intent =
  | "KNOWLEDGE"
  | "BOOK_CALL"
  | "CLIENT_PORTAL"
  | "PRICING"
  | "ESCALATION"
  | "UNKNOWN";
```

The taxonomy may evolve after real examples are tested.

Use structured output.

Validate the result.

If classification fails, route to a safe fallback.

---

# 8. Knowledge Architecture

Do not place the entire Cadre knowledge base in the system prompt.

The system prompt defines behavior.

The knowledge layer defines business facts.

## These files already exist — do not rewrite them

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

All nine are already written and committed at the repo root, sourced from the take-home brief and cadreai.com. Each already documents its own knowledge gaps in an "If asked something not covered here" section — those are intentional boundaries, not TODOs. Read them; do not re-author, re-research, or "improve" their content. If implementation reveals a real gap none of the nine files cover, that's a signal to route to escalation, not to add invented facts to these files.

Do not invent missing details.

## How these files reach the running application (firm decision)

`knowledge/*.md` is never read from disk at request time. A build step (`npm run build:knowledge`, part of `prebuild`) compiles every file into a single statically-imported module:

```text
knowledge/*.md  →  scripts/build-knowledge.ts  →  lib/knowledge/generated.ts
```

`lib/knowledge/generated.ts` exports `KNOWLEDGE_TOPICS: Record<TopicId, { title: string; content: string }>`, where `TopicId` is a closed union matching the file list above. The orchestrator imports this module directly — no `fs.readFileSync` in any code path that runs in production. This avoids a real failure mode: Next.js output tracing on Firebase App Hosting/Cloud Run does not reliably bundle arbitrary files read via dynamic filesystem calls, only files reachable through static imports.

---

# 9. Knowledge Lookup — deterministic-first (P0, complete on its own), semantic stretch second (P2)

Full RAG (chunking + embeddings + similarity search) is **not** the primary grounding mechanism, and it isn't even simpler to build than the alternative below — it trades a keyword map for an embeddings pipeline, a similarity threshold, and non-obvious test fixtures, to solve a scale/ambiguity problem this ~9-document corpus doesn't have. Instead:

## Step 1 (P0 — complete and shippable on its own) — Deterministic topic lookup

```text
message
  ↓
intent = KNOWLEDGE?
  ↓ yes
topic selection (deterministic, in this order):
  1. match against the finite INDUSTRIES list → industries.md
  2. match against a fixed topic → trigger-terms map (see PLAN.md Phase 7)
  3. default → about-cadre.md + services.md
  ↓
match found → inject that topic's content from KNOWLEDGE_TOPICS into context, done
no match  → escalate (P0 behavior — stops here unless Step 2 was built)
```

Deterministic topic lookup is exactly and cheaply unit-testable, adds zero latency to the common case, and is a fully sufficient, defensible answer to "Cadre knowledge answers" by itself. Do not treat it as incomplete without Step 2.

## Step 2 (P2/stretch — build only after P0 is solid and every P1 item is done)

Not a P1 commitment. Follows "cut scope aggressively — 3 working features beat 8 broken ones": a fragile stretch feature is worse than not building it. If time runs out before this, that's correct, not a shortfall.

Rather than escalate immediately on a keyword miss, try one semantic pass over the same finite document set before giving up — this catches real questions phrased differently than the trigger terms anticipate (e.g. "your eight-pillar scoring thing" instead of "AI Maturity Index").

```text
no match from Step 1
  ↓
embed the message (OpenRouter `/embeddings` endpoint — same `OPENROUTER_API_KEY` as chat — see PLAN.md Phase 7)
  ↓
cosine-similarity search over pre-embedded knowledge docs (Supabase pgvector)
  ↓
best match above threshold → inject it, done
below threshold / no result → escalate
```

Document-level embeddings, not paragraph chunking — each `knowledge/*.md` file is short enough to embed whole; chunking would solve a document-size problem that doesn't exist here.

Never fall back to the model's own general knowledge about Cadre — if both steps come up empty (or Step 2 was never built), escalate.

Keep `selectTopics()` (Step 1) and `semanticFallback()` (Step 2) as small, independently unit-tested functions, the latter tested with a mocked embedding client, not a live API call.

---

# 10. System Prompt Principles

The system prompt should define:

- assistant role
- audience
- tone
- scope
- grounding rules
- escalation rules
- security boundaries
- prompt-injection resistance
- response format where necessary

It should not contain a giant copy of the knowledge base.

The assistant should distinguish:

1. verified information
2. reasonable next steps
3. unknown information

Never pretend to have accessed a client system, portal, CRM, calendar, or private database unless the application actually has that capability.

---

# 11. Grounding Policy

For a knowledge question:

```text
Question
  ↓
Step 1: deterministic selectTopics() (Section 9)
  ↓
Matched? ── yes → generate grounded answer from that topic's content only
  │
  no
  ↓
Step 2: semanticFallback() (Section 9, P2/stretch only)
  ↓
Matched above threshold? ── yes → generate grounded answer from that topic's content only
  │
  no
  ↓
limitation + escalation/redirect
```

Avoid fake confidence scores.

If confidence is used internally, treat it as one signal rather than truth.

The important decision is whether enough verified information exists to answer safely.

---

# 12. Escalation Policy

Escalate when:

- the request is outside supported scope
- topic lookup (Section 9) found no matching knowledge topic
- the user requests client-specific information
- the assistant cannot verify an important fact
- the request requires a capability the chatbot does not have

The escalation message should remain useful.

Do not simply say:

> "I don't know."

Prefer:

> "I don't have enough verified information to answer that accurately. I can help with Cadre's services, industries, AI Maturity Index, and how to get started. For a client-specific question, the best next step is to speak with the Cadre team."

Adapt the exact text to verified project information.

---

# 13. Booking Flow

The chatbot must not invent a booking URL.

Use only the official booking information actually available in the project.

If no verified booking link is available:

- explain that a strategy call is the appropriate next step
- provide the approved contact/booking mechanism if one exists
- otherwise escalate

Keep the business flow deterministic.

---

# 14. Client Portal Flow

The chatbot must not pretend to authenticate a user or access the portal.

If approved instructions exist:

- provide them clearly

Otherwise:

- say that the bot does not have access
- provide the verified next step
- escalate if appropriate

---

# 15. Security Rules

## Secrets

Never commit:

- OpenRouter API key
- Supabase service-role key
- Firebase credentials
- GitHub tokens
- any other credential

Never use a secret in client-side code.

Server-only secrets must never use `NEXT_PUBLIC_*`.

## User input

Treat all user input as untrusted.

Prompt injection must not change:

- system rules
- scope
- application routing
- permissions
- escalation policy
- secrets

## Database

If authentication is introduced later:

- use proper Supabase RLS
- enforce authorization server-side
- do not rely on client-side hiding

Do not add authentication simply to demonstrate authentication.

## Abuse protection (not authentication)

The chat endpoint is public and unauthenticated by design — a support bot for prospective/existing clients must not require login. But every message costs real, limited OpenRouter budget, so `/api/chat` must enforce rate limiting (IP or session based; a Supabase table or in-memory counter is enough — see PLAN.md Phase 5). A public endpoint with an LLM behind it and no rate limit is a way to burn the challenge's OpenRouter budget by accident or on purpose. Auth solves a different problem (identity) than rate limiting solves (abuse/cost) — do not conflate them, and do not skip rate limiting because auth was correctly ruled out.

---

# 16. Supabase Rules

Use:

```text
lib/supabase/client.ts
lib/supabase/server.ts
```

Use `@supabase/ssr`.

Do not create a new client in every random module.

Keep DB access behind clear repository/data-access functions where application complexity warrants it.

## Session identity vs rate-limit key — do not conflate

`conversationId` (client-generated UUID, persisted in `localStorage`) identifies a conversation for continuity/UX — it is what ties rows in `messages` together and lets a page reload recover the same chat. It is **not** an abuse-prevention signal: it's trivially resettable by clearing `localStorage`. Rate limiting (Section 15) is keyed by IP instead, for exactly that reason. Two different keys, two different jobs — never rate-limit by `conversationId` and never key persistence by IP.

## Schema (concrete — see `PLAN.md` Phase 2 for the full column list)

```text
conversations   id, created_at, last_message_at
messages        id, conversation_id (FK), role, content, intent, matched_topic, created_at
escalations     id, conversation_id (FK), message_id (FK), reason, created_at
rate_limits     key (IP), window_start, count
```

A `knowledge_embeddings` table (`topic_id text primary key, embedding vector(1536), content text` — 1536 matches `openai/text-embedding-3-small` via OpenRouter, see PLAN.md Phase 7) is added only in P2/stretch, only for the semantic fallback (Section 9, Step 2) — not before, and not at all unless Step 2 gets built. Do not add it while still on P0/P1.

Every schema change must have a migration.

---

# 17. Suggested Repository Structure

```text
/
├── .github/
│   └── workflows/
│       └── ci-deploy.yml       (validate + deploy jobs — see Section 29)
│
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts
│   ├── page.tsx
│   ├── layout.tsx
│   └── globals.css
│
├── components/
│   ├── chat/
│   ├── ui/
│   └── layout/
│
├── lib/
│   ├── ai/
│   │   ├── provider.ts
│   │   ├── openrouter.ts        (chat/completions AND /embeddings — no gemini.ts, see Section 4)
│   │   ├── orchestrator.ts
│   │   ├── prompts.ts
│   │   └── schemas.ts
│   ├── api/
│   │   └── rateLimit.ts        (see Section 15)
│   ├── knowledge/
│   │   ├── generated.ts        (built from knowledge/*.md — never edited by hand)
│   │   └── semanticFallback.ts (P2/stretch — see Section 9, Step 2)
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   └── business/
│       ├── intents.ts
│       ├── topicRouting.ts     (deterministic selectTopics() — see Section 9, Step 1)
│       ├── booking.ts
│       ├── portal.ts
│       └── escalation.ts
│
├── knowledge/                  (source .md files, human-edited — already written, see repo root)
├── scripts/
│   ├── build-knowledge.ts
│   └── embed-knowledge.ts      (P2/stretch — see Section 9, Step 2)
├── supabase/
│   └── migrations/
├── tests/
├── CLAUDE.md
├── PLAN.md
├── README.md
├── apphosting.yaml
├── next.config.ts
├── package.json
├── tsconfig.json
└── .env.example
```

Do not create directories only because they appear in this example.

Create them when implementation requires them.

---

# 18. Next.js Rules

Use App Router.

Prefer Server Components.

Use Client Components only when required for:

- interactive state
- browser APIs
- event handlers
- streaming UI

Do not make the entire application client-side.

Do not import server-only modules into client components.

---

# 19. TypeScript Rules

Use strict TypeScript.

Avoid `any`.

Validate external inputs.

Validate all LLM structured outputs.

Use domain types for:

- intents
- message roles
- AI results
- escalation reasons
- topic lookup results

Do not over-type trivial internal code.

---

# 20. UI Rules

Use Tailwind CSS.

The visual goal is:

- professional B2B SaaS
- warm enough to feel human
- minimal
- responsive
- accessible
- readable

Prioritize:

1. excellent chat readability
2. obvious input interaction
3. clear states
4. trustworthy visual hierarchy

Do not build a giant design system.

Do not add animations unless they meaningfully improve UX.

## 20.1 Brand & Visual Language

Cadre AI's own site (cadreai.com) sets the register: premium, trustworthy, B2B — built for private equity, financial services, and professional-services buyers. Mirror that instead of a generic "AI startup" look with default Tailwind indigo/purple gradients.

Voice cues confirmed from the live site (safe to reuse in copy/UI text, not as fabricated product facts):

- Positioning line: "From AI Confusion to AI Confidence."
- Primary CTA pattern: "Talk to an AI Strategist."
- The AI Maturity Index is described on-site as scoring a business across an eight-pillar framework — reuse this exact framing if the assistant discusses it.

### Color tokens — confirm before hardcoding

An exact hex palette could not be reliably extracted from a text fetch of the live site. Do not invent hex codes and present them as Cadre's official brand colors.

1. Before implementation, confirm real values: inspect cadreai.com (DevTools → computed styles on the logo, nav, and primary CTA button) or use any brand kit Cadre may share for the challenge.
2. Define confirmed values as CSS variables in `app/globals.css`:

```css
:root {
  --cadre-primary: /* TODO: confirm from cadreai.com */;
  --cadre-primary-foreground: /* TODO */;
  --cadre-accent: /* TODO */;
  --cadre-background: /* TODO */;
  --cadre-muted: /* TODO */;
}
```

3. Until confirmed, fall back to a conservative placeholder consistent with the site's tone — near-navy/near-black primary, one warm accent, white/off-white background, generous whitespace — never a generic default SaaS palette.

If asked in the review, say plainly that the palette is a placeholder pending confirmed brand values, not that it is Cadre's official palette.

---

# 21. Error Handling

Handle failures from:

- OpenRouter (chat and, if Step 2/P2 was built, embeddings)
- Supabase
- topic lookup returning no match
- network
- timeouts
- invalid model output
- rate limits

User errors should be friendly.

Developer errors should be diagnosable.

Never include secrets in logs.

Prefer structured error objects over string comparisons.

---

# 22. Testing Strategy

Tests should be mostly deterministic.

Do not call a paid LLM for every test.

Use:

- mocked provider responses
- fixed fixtures
- representative evaluation cases

Minimum coverage:

### Intent

- knowledge
- booking
- portal
- pricing
- unknown

### Grounding

- Step 1 deterministic match (P0 — always required)
- Step 2 semantic fallback match (mocked embedding client — only if Step 2/P2 was built)
- no match → escalate, no invented context (this must hold with or without Step 2)

### Escalation

- unknown
- both lookup steps return no match
- client-specific question
- unsupported action

### Abuse protection

- rate limit allows requests under the cap
- rate limit rejects the request over the cap, with a friendly UI state

### Security

- prompt injection
- secret extraction attempt
- role manipulation attempt

### API

- malformed input
- provider failure
- timeout
- invalid AI output

### UI

- send
- loading
- error
- escalation

---

# 23. AI Evaluation Set

Maintain a small evaluation fixture.

Suggested categories:

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

Evaluate expected behavior, not exact wording.

Example:

```json
{
  "input": "Do you work with construction companies?",
  "expectedIntent": "KNOWLEDGE",
  "expectedBehavior": "Answer from approved industry knowledge."
}
```

---

# 24. AI Assistant Efficiency Rules

These rules are mandatory.

Before modifying code:

1. Read this file.
2. Read the relevant section of `PLAN.md`.
3. Inspect only files directly relevant to the current task.
4. Reuse existing patterns.
5. Make the smallest complete change.
6. Verify the change.

Do not:

- rescan the entire repository unnecessarily
- rewrite working code
- regenerate files without need
- refactor unrelated code
- install dependencies without justification
- implement future phases early
- create abstractions before they solve a real problem
- add features because they sound impressive

Prefer focused tasks such as:

> Implement Phase 3 intent routing only.

over:

> Build the whole chatbot.

---

# 25. Context Management Rules

Claude should keep the working context small.

When a task is complete:

- summarize what changed
- list verification performed
- mention unresolved issues
- stop — this explicitly does not include committing or pushing; see Section 28

Do not continue into unrelated improvements unless explicitly requested.

If a task touches multiple architectural areas, inspect the minimum required files first.

Prefer targeted searches over repository-wide exploration.

---

# 26. Dependency Policy

Every new dependency must answer:

1. What problem does it solve?
2. Can existing tooling solve the problem?
3. Is it production-relevant?
4. Does it increase maintenance burden?

Do not add dependencies for tiny utilities.

Prefer stable, well-known libraries already aligned with Next.js/Supabase.

---

# 27. Subagent Policy

Use subagents only for independent work.

Good uses:

- architecture review
- security review
- test review
- UX review
- final code review

Do not use several agents simultaneously on tightly coupled code.

Do not delegate integration ownership.

The primary agent owns the final architecture and verification.

Subagents should return concise findings rather than rewriting large portions of the repository.

---

# 28. Commit Boundary — Claude Code never commits or pushes

**Claude Code does not run `git commit`, `git push`, `git add` for the purpose of committing, or open pull requests, under any circumstance — including when a task "looks done."** The developer reviews every change and commits it manually. This is not a style preference; treat it as a hard stop.

What Claude Code can do with git: read-only introspection — `git status`, `git diff`, `git log` — to understand current state before making a change. Never anything that mutates repository history or remote state.

When a task is complete:

- leave the change applied in the working tree
- summarize what changed and how it was verified (tests run, manual checks done)
- stop — do not stage, commit, or push as a follow-on step

If the developer explicitly types something like "commit this" in a session, that instruction applies to that one request only — it is not a standing permission for future tasks.

## Commit practice for the developer (not a Claude Code task — for when you commit)

Small, focused commits. Preferred prefixes:

```text
feat:
fix:
test:
refactor:
chore:
docs:
```

Examples:

```text
feat: add chat shell
feat: add OpenRouter provider
feat: add intent routing
feat: add deterministic topic lookup
fix: handle provider timeout
test: add escalation evaluation cases
chore: configure Firebase App Hosting rollout
docs: update architecture
```

Avoid giant commits.

---

# 29. CI/CD

The GitHub repository, Firebase project, and App Hosting backend already exist. This section governs how code reaches them — it does not create them.

CI must validate:

```text
install
→ lint
→ typecheck
→ tests
→ build
```

## Firm decision

Automatic rollout-on-push is turned off on the App Hosting backend. A single workflow, `.github/workflows/ci-deploy.yml`, has a `validate` job (runs on PRs and pushes to `main`) and a `deploy` job (`needs: validate`, runs only on push to `main`) that explicitly triggers a rollout for that exact commit via `firebase apphosting:rollouts:create`. `main` has branch protection requiring `validate` to pass before merge. See `PLAN.md` Phase 1 for the full task list.

Store deployment credentials securely.

Do not commit service-account JSON.

Do not expose deployment credentials in logs.

---

# 30. Firebase App Hosting

The app is a Next.js application deployed to the existing Firebase App Hosting backend.

Use the repository's App Hosting configuration only for app/runtime configuration — do not provision a new backend or project.

Keep secrets in Firebase/Google Secret Manager or the App Hosting secret mechanism rather than source control.

The deployment pipeline must remain reproducible.

Do not create a second unrelated Firebase Hosting architecture just for deployment.

---

# 31. Environment Variables

Document required variables in `.env.example`.

Expected categories (application runtime, injected via App Hosting secrets):

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

OPENROUTER_API_KEY
OPENROUTER_MODEL              (chat)
OPENROUTER_EMBEDDING_MODEL    (openai/text-embedding-3-small, 1536 dimensions — add only if Phase 7 Step 2 / P2 semantic fallback gets built; omit entirely otherwise)
```

No extra AI provider variables belong in this file beyond the OpenRouter settings already described above.

Separately, the `deploy` GitHub Actions job needs its own repo secrets/variables (CI/CD-only, not part of the app's `.env.example`):

```text
FIREBASE_PROJECT_ID
FIREBASE_BACKEND_ID
FIREBASE_REGION
```

Only add variables actually used.

`OPENROUTER_API_KEY` covers both chat and (if built) the Step 2 semantic fallback's embeddings — same key, same provider, no second credential to manage.

OpenRouter remains the sole LLM/embedding provider in the deployed app, for generation and for the optional P2 semantic fallback alike.

---

# 32. Definition of Done

A task is done only when:

- implementation is complete
- TypeScript passes
- lint passes
- relevant tests pass
- error paths are considered
- security implications are reviewed
- UI works if applicable
- documentation is updated if architecture changed

Generated code is never considered correct merely because it compiles.

---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
