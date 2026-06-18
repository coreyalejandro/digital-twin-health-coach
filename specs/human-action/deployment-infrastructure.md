# Production Deployment Infrastructure

**Report basis:** §1.1 (stack), T4 (key rotation via secret management, fallback),
§3 Phase 3 (device integration for the Deep Twin).

## What the codebase already provides (swappable seams)
- **Persistence**: all state goes through `infrastructure/storage/repository.ts`
  interfaces; in-memory implementations are used here. Swap for PostgreSQL
  (structured data) + Redis (sessions) without touching business logic.
- **Secrets**: provider keys are read via `providersFromEnv` (secret-manager
  sourced) — never `.env.local`. Adapters exist for Gemini/Claude/OpenAI.
- **Resilience**: rate limiter, circuit breaker, timeouts already in the pipeline.
- **Audit store**: append-only + hash-chain; point it at a WORM/object-lock store.
- **Twin**: `TwinEngine` interface with `DeepTwinPlaceholder` ready to be replaced.

## What humans/ops must do (cannot be code here; registry blocked in sandbox)
1. `npm install` the Next.js/React toolchain (blocked in this sandbox by policy)
   and run `next build` for the App Router UI in `app/`.
2. Provision PostgreSQL + Redis; implement the repository adapters.
3. Configure the secret manager; set `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` /
   `OPENAI_API_KEY`; enable scheduled key rotation.
4. Point the audit store at tamper-evident WORM storage.
5. (Phase 3) Integrate wearable/device feeds to implement a real `DeepTwin`.

## Acceptance criteria
- `next build` green; the core test suite (`node --test`) green in CI.
- Repository adapters pass the same contract tests as the in-memory store.
- Secret rotation verified; no secrets in source (enforced by `ci-checks.ts`).

## Note on this build
The core (domain, application, governance, infrastructure) is **dependency-free
TypeScript that runs and is fully tested on Node 24** precisely so it does not
depend on the blocked package registry. The Next.js files are correct source for
the production UI; they import the identical, tested core.
