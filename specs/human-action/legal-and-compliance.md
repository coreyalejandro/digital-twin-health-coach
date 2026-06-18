# Legal Review, Terms of Service & ISO Posture

**Report basis:** Stakeholder 1 §6 (legal review of user-facing copy; ToS
disclaiming medical advice; risk classification; ISO 13485 / 27001).

## What the codebase already provides
- A **risk-classification framework** in code: the four-tier classifier
  (`classify/classifier.ts`) and hard boundary (`safety/medicalBoundary.ts`)
  applying differential governance per tier.
- **Disclaimers** bound to every answer via confidence tiers
  (`domain/confidence.ts:TIER_DISCLAIMER`) and the explanation builder.
- **Consent records** (`consent/consentService.ts`) and an **immutable audit
  trail** (`governance/audit/auditLog.ts`) — the evidentiary substrate for
  compliance and incident investigation.
- CI **secret/PII scanning** (`scripts/ci-checks.ts`) toward 27001 hygiene.

## What humans must do (cannot be code)
1. **Counsel review** of *all* user-facing copy to ensure no implied medical
   authority; finalise the ToS that disclaims medical advice with explicit
   user acknowledgement.
2. **Regulatory determination**: confirm wellness-vs-SaMD classification with
   FDA/FTC (and state) counsel; document the rationale.
3. **ISO programmes**: scope ISO 13485 (quality) and ISO 27001 (infosec); run
   the certification process. (Not legally mandatory for "wellness", but a trust
   differentiator per the report.)

## Acceptance criteria
- Signed-off ToS + onboarding acknowledgement gate before condition-management mode.
- Written regulatory classification memo from counsel.
- ISO 27001 Statement of Applicability drafted; 13485 gap analysis complete.

## Runbook
1. Export the risk-tier matrix and disclaimer copy for counsel review.
2. Implement the ToS acknowledgement gate (consent scope already supports it).
3. Engage an ISO consultancy; map existing audit/consent controls to clauses.
