# Digital Twin Health Coach — Enhanced Plan v2.0

A constitutionally-governed, neurodivergent-first wellness coach that transforms
the original "chatbot on the Gemini API" prototype into a demonstrable
application of constitutional-AI safety infrastructure. Every recommendation
passes through a governance layer (SentinelOS invariants I1–I6), a hard
medical-advice boundary, behavioural safety monitoring, and an immutable,
cryptographically-verified audit log.

This repository implements **every software-implementable enhancement** from the
stakeholder report — all Essential (E1–E7), Table Stakes (T1–T8), and High-Value
(H1–H8) items, the four Key Tensions, and the Consolidated Plan §1–§10. See
[`docs/TRACEABILITY.md`](docs/TRACEABILITY.md) for the item-by-item mapping.

## Safety posture (what the system will NOT do)

- It does **not** diagnose, prescribe, interpret labs, or change medication.
  Such queries are **blocked and escalated to a human** (E1).
- It does **not** handle emergencies; self-harm / acute-symptom signals trigger
  **crisis resources + human escalation** (E6).
- It **fails closed** (I6): ambiguity, upstream errors, model disagreement, or
  any invariant violation withhold the answer rather than risk harm.
- It never claims capabilities it doesn't have (I2 — No Phantom Work).

## Architecture (clean architecture, report §1.2)

```
src/
  domain/          health models, consent, query tiers, confidence, results, time
  application/     classify, safety (boundary/filters/netting/escalation), coaching
                   (the pipeline spine), twin, consent, profile, explain, care,
                   portability, dsl, resilience, modes, knowledge
  infrastructure/  storage repositories, crypto signing, AI providers (Gemini/
                   Claude/OpenAI + mock + multi-model router), http
  governance/      SentinelOS invariants, audit log, prompt registry, Agent
                   Sentinel anomaly detection, agency score, metrics, dashboard,
                   data trust
  presentation/    node:http server + accessible HTML UI
app/               Next.js App Router target (production UI; imports the core)
redteam/           adversarial battery (H1) + runner
scripts/           verify (integration smoke) + ci-checks (secrets/deps/safety)
specs/             DSL spec (.dtsl) + human-action specs
docs/              traceability matrix
```

The **coaching pipeline** (`src/application/coaching/coachingService.ts`) composes
everything: `rate limit → circuit breaker → input risk → classify → safety-net →
medical boundary + rollout gate → multi-model generation (timeout-bounded) →
output filter → layered explanation → SentinelOS I1–I6 → audit + behavioural
signals (Sentinel anomalies + agency score)`. Any failure becomes a safe,
escalated response — never a raw model output.

## Running it

Requires **Node.js ≥ 24** (uses native TypeScript execution; no build step, no
third-party dependencies).

```bash
# Full unit + integration test suite (105 tests)
npm test                      # = node --test

# Adversarial red-team battery only
npm run redteam               # = node --test redteam/

# End-to-end integration verification (battery + scenarios + audit integrity)
npm run verify                # = node scripts/verify.ts

# CI compliance checks (secret/PII scan, supply-chain, prompt-safety lint)
node scripts/ci-checks.ts

# Run the live demo app (node:http) and open http://127.0.0.1:3000
npm run demo                  # = node src/presentation/server.ts
```

Set `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` (from a secret
manager) to use real models; otherwise a deterministic mock provider is used —
safety is enforced by the pipeline, not by the model.

## Why dependency-free TypeScript?

This build runs in a sandbox where the public npm registry is **blocked by
policy** (HTTP 403). Rather than fake a build, the entire core (domain,
application, governance, infrastructure) is written as **dependency-free
TypeScript that runs and is fully tested on Node 24's native TS execution**.
This is also good architecture: all business/safety logic is framework-agnostic.

The `app/` directory contains the **Next.js App Router UI** specified in the
report. It is correct source that imports the identical, tested core, but
`next build` requires `npm install` (blocked here) — see
[`specs/human-action/deployment-infrastructure.md`](specs/human-action/deployment-infrastructure.md).
The bundled `node:http` server (`npm run demo`) provides a fully runnable UI in
the meantime.

## Honesty boundary (No Phantom Work)

Some report items are not software (usability testing & co-design with
neurodivergent users, licensed-clinician escalation staffing, legal/ISO review,
the legal data-trust entity, production infra). For each, the codebase provides
the hook/interface/substrate and the work-to-close is documented in
[`specs/human-action/`](specs/human-action/). These are marked 🟡 in the
traceability matrix — never silently claimed as done.
