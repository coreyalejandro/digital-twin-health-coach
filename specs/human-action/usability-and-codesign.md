# Usability Testing & Co-Design with Neurodivergent Users

**Report basis:** E4 (neurodivergent-first UX), §9.2 (user research), Stakeholder 3
("conduct usability testing with neurodivergent users *before* claiming the app
serves them"; "partner with neurodivergent-led organisations for co-design").

## What the codebase already provides
- A **structured-first** interaction model (open chat is opt-in), implemented in
  `domain/health.ts:InteractionPreferences` and the UI (`presentation/ui.ts`, `app/page.tsx`).
- **Cognitive-load** and **explanation-depth** controls wired through
  `explain/explanationBuilder.ts:renderExplanation`.
- Accessibility scaffolding: skip link, semantic landmarks, ARIA live regions,
  visible focus, `prefers-reduced-motion`, large targets, turn-taking signal.
- An interaction-preference store ready to drive per-user adaptation.

## What humans must do (cannot be code)
1. **Recruit** neurodivergent participants across profiles (ADHD, autism,
   executive-function differences, chronic-condition comorbidity).
2. **Moderated usability sessions** on the structured, schedule, and chat modes;
   capture cognitive load, error/recovery, and distress signals.
3. **Co-design** with neurodivergent-led organisations — shift decision power,
   not just gather feedback (report: "this is not just user testing — it is
   shifting power to the population you claim to serve").
4. **Iterate** the UI and `InteractionPreferences` defaults from findings.

## Acceptance criteria (definition of done)
- ≥ 2 rounds of moderated testing with ≥ 5 neurodivergent participants each.
- A signed co-design partnership with at least one ND-led organisation.
- WCAG 2.1 AA audit by a third party (complements the automated checks).
- Documented changes traceable back to participant findings.

## Runbook
1. IRB/ethics review of the study protocol.
2. Recruit via ND-led orgs; compensate participants fairly.
3. Run sessions; log findings against the interaction modes.
4. File issues tagged `nd-codesign`; ship changes behind the rollout gate.
5. Re-test; only then advertise the app as serving these users.
