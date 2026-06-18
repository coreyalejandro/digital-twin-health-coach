# Traceability Matrix — Enhanced Plan v2.0

Maps **every** enhancement in the report (Essential E1–E7, Table Stakes T1–T8,
High-Value H1–H8), the four Key Tensions, and the Consolidated Plan §1–§10 to
the code that implements it and the tests that verify it.

- **Status legend:** ✅ Implemented & tested in code · 🟡 Software implemented + a
  documented human/organisational action to fully close (see `specs/human-action/`).
- Verification backbone: `node --test` (105 tests), `node redteam/battery.test.ts`
  (16 adversarial cases), `node scripts/verify.ts`, `node scripts/ci-checks.ts`.

## Essential

| # | Enhancement | Status | Code | Tests |
|---|-------------|--------|------|-------|
| E1 | Hard medical-advice boundary + auto-escalation | ✅ | `application/classify/classifier.ts`, `application/safety/medicalBoundary.ts`, `application/safety/escalation.ts` | `safety/safetyCore.test.ts`, `coaching/coaching.e2e.test.ts`, `redteam/battery.test.ts` |
| E2 | SentinelOS I1–I6 in the request/response pipeline | ✅ | `governance/invariants/sentinelos.ts`, integrated in `application/coaching/coachingService.ts` | `governance/invariants/sentinelos.test.ts`, `coaching/coaching.e2e.test.ts` |
| E3 | Scope honesty — build the twin or rename (No Phantom Work) | ✅ | `application/twin/twinEngine.ts` (`LightTwin` + honest `DeepTwinPlaceholder`); product named "Health Coach / light twin" | `application/twin/twin.test.ts` |
| E4 | Neurodivergent-first UX (structured, turn-taking, load mgmt) | 🟡 | `domain/health.ts` (`InteractionPreferences`), `presentation/ui.ts`, `app/page.tsx`, `application/explain/explanationBuilder.ts` | `safety/escalationAndExplain.test.ts`; ND user testing → `specs/human-action/usability-and-codesign.md` |
| E5 | Immutable, cryptographically verified audit logs | ✅ | `governance/audit/auditLog.ts`, `infrastructure/crypto/signing.ts`, write-once `infrastructure/storage` | `governance/audit/auditLog.test.ts` |
| E6 | Safety netting + automatic human escalation | ✅ | `application/safety/safetyNetting.ts`, `application/safety/escalation.ts` | `safety/escalationAndExplain.test.ts`, `coaching/coaching.e2e.test.ts` |
| E7 | Explainable AI — layered reasoning per recommendation | ✅ | `application/explain/explanationBuilder.ts`, `domain/explanation.ts` | `safety/escalationAndExplain.test.ts` |

## Table Stakes

| # | Enhancement | Status | Code | Tests |
|---|-------------|--------|------|-------|
| T1 | Prompt registry, versioned, clinical-safety review gate | ✅ | `governance/prompts/promptRegistry.ts` (review + adversarial gates) | `governance/prompts/promptRegistry.test.ts` |
| T2 | Structured health profile storage + granular consent | ✅ | `application/profile/profileService.ts`, `application/consent/consentService.ts`, `domain/consent.ts` | `application/profile/profileConsent.test.ts` |
| T3 | Input/output filtering (drugs, self-harm, ED, tone, certainty) | ✅ | `application/safety/filters.ts` | `safety/safetyCore.test.ts` |
| T4 | API security: rate limit, breaker, multi-model fallback + consistency | ✅ | `application/resilience/{rateLimiter,circuitBreaker,timeout}.ts`, `infrastructure/providers/multiModel.ts` | `application/resilience/resilience.test.ts`, `infrastructure/providers/providers.test.ts` |
| T5 | WCAG 2.1 AA + cognitive accessibility | 🟡 | `presentation/ui.ts` (skip link, ARIA live, focus, reduced-motion, large targets), cognitive-load in `explanationBuilder.ts` | render tests; third-party AA audit → `specs/human-action/usability-and-codesign.md` |
| T6 | Automated regression for safety-critical prompt behaviour | ✅ | `redteam/battery.ts` + `promptRegistry` adversarial gate + `.github/workflows/ci.yml` | `redteam/battery.test.ts` |
| T7 | Visible "I need human help" on every screen | ✅ | `application/safety/escalation.ts` (`panic`), `presentation/ui.ts` fixed button, `app/api/panic/route.ts` | `safety/escalationAndExplain.test.ts`; server verified |
| T8 | Health-data portability (FHIR-compatible export/import) | ✅ | `application/portability/fhir.ts` | `application/care/carePortability.test.ts` |

## High Value Added

| # | Enhancement | Status | Code | Tests |
|---|-------------|--------|------|-------|
| H1 | Red-team evaluation harness, in CI | ✅ | `redteam/battery.ts`, `.github/workflows/ci.yml`, `scripts/verify.ts` | `redteam/battery.test.ts` |
| H2 | Agent Sentinel behavioural anomaly detection | ✅ | `governance/sentinel/anomaly.ts`, wired in `coachingService.updateBehaviour` | `governance/sentinel/anomaly.test.ts`, `coaching/coaching.e2e.test.ts` |
| H3 | Twin fidelity score | ✅ | `application/twin/fidelity.ts` | `application/twin/twin.test.ts` |
| H4 | Health agency score + intervention triggers | ✅ | `governance/agency/agencyScore.ts`, wired in pipeline | `governance/agency/agencyScore.test.ts`, `coaching/coaching.e2e.test.ts` |
| H5 | Governance dashboard for non-technical stakeholders | ✅ | `governance/dashboard/dashboard.ts`, `governance/metrics/metrics.ts`, `/api/dashboard` | `governance/metrics/metricsDashboard.test.ts` |
| H6 | Care constellation with explicit role clarity | ✅ | `application/care/careConstellation.ts` | `application/care/carePortability.test.ts` |
| H7 | Digital twin specification language | ✅ | `application/dsl/dsl.ts`, `specs/dsl/coaching.dtsl` | `application/dsl/dsl.test.ts` |
| H8 | User data trust (collective governance + accounting) | 🟡 | `governance/datatrust/dataTrust.ts` (software substrate) | `governance/datatrust/dataTrust.test.ts`; legal entity → `specs/human-action/user-data-trust.md` |

## Key Tensions — adjudications implemented

| Tension | Adjudication | Code |
|---------|--------------|------|
| 1 Speed vs Safety | Staged rollout: wellness-only vs condition-management | `application/modes/rollout.ts` |
| 2 Accessibility vs Complexity | Depth-first: one deeply accessible structured mode is the default | `domain/health.ts`, `presentation/ui.ts` |
| 3 Transparency vs Cognitive Load | Layered explainability (summary default, detail on demand) | `application/explain/explanationBuilder.ts` |
| 4 Data Minimisation vs Twin Fidelity | Light vs Deep twin + per-scope consent (`deep_twin`) | `application/twin/twinEngine.ts`, `domain/consent.ts` |

## Consolidated Plan §1–§10

| § | Area | Where |
|---|------|-------|
| 1 | Foundational clean architecture (domain/application/infrastructure/governance/presentation) | repo layout |
| 2 | Safety & governance (SentinelOS, boundary, netting, audit) | `governance/*`, `application/safety/*` |
| 3 | Digital twin (phased, fidelity) | `application/twin/*` |
| 4 | Neurodivergent-first UX (modes, accessibility, explainability) | `presentation/*`, `application/explain/*` |
| 5 | Behavioural safety & agency | `governance/sentinel/*`, `governance/agency/*`, `application/safety/filters.ts` |
| 6 | Operational resilience | `application/resilience/*` |
| 7 | Care coordination & portability | `application/care/*`, `application/portability/*` |
| 8 | Governance & transparency (dashboard, DSL, data trust) | `governance/dashboard/*`, `application/dsl/*`, `governance/datatrust/*` |
| 9 | Validation & evaluation (red team, metrics) | `redteam/*`, `governance/metrics/*`, `scripts/verify.ts` |
| 10 | Phased rollout / differential governance | `application/modes/rollout.ts` |
