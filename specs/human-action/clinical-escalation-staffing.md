# Licensed-Clinician Escalation Staffing

**Report basis:** E6 (safety netting + human escalation), T7 ("I need human
help"), §2.3, Stakeholder 1 (automatic escalation to a human clinician).

## What the codebase already provides
- `application/safety/escalation.ts:EscalationService` opens escalations
  (`clinician` / `crisis` / `human_help`) with **full context** and writes an
  audit event.
- A `Notifier` interface (with an in-memory `RecordingNotifier` for tests/demo)
  — the integration seam for a real on-call system.
- The unconditional **panic path** (`panic()`), surfaced on every screen.
- Crisis resources (`CRISIS_RESOURCES`) returned for emergency-tier interactions.
- Safety netting (`safetyNetting.ts`) and the medical boundary that *generate*
  these escalations automatically.

## What humans/organisations must do (cannot be code)
1. **Staff an on-call rota** of licensed clinicians / trained crisis responders
   with defined SLAs per escalation kind (crisis = immediate).
2. **Implement a real `Notifier`** (PagerDuty/Opsgenie/SMS/secure inbox) and
   inject it in `buildCoach.ts` in place of `RecordingNotifier`.
3. Define **acknowledge → triage → close** workflow ownership and audit review.
4. Establish a clinical governance committee to review escalation appropriateness.

## Acceptance criteria
- Median acknowledgement time within SLA per kind, measured from audit timestamps.
- 100% of `crisis` escalations reach a human; periodic drill evidence.
- Escalation-appropriateness review cadence documented and running.

## Runbook
1. Implement `class PagerNotifier implements Notifier`.
2. Provision the on-call schedule + escalation policy.
3. Inject the notifier; run a staging fire-drill against each escalation kind.
4. Add the median-ack-time metric to the governance dashboard review.
