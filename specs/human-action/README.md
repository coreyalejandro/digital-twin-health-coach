# Human-Action Items

Some of the report's enhancements are **not software** and cannot honestly be
marked "done" by a coding agent (report I2 *No Phantom Work*, Safety Axiom).
This directory documents each one: **what the codebase already provides** (the
hook, interface, or scaffold), **what humans/organisations must do**, and the
**acceptance criteria** that close the gap.

Treating these as code would be a phantom-work violation. Treating them as
"impossible" would be wrong too — the software is built right up to the seam.

| Item | Report ref | Software provided | Human action required | Spec |
|------|-----------|-------------------|-----------------------|------|
| Usability testing & co-design with neurodivergent users | E4, §9.2, H(user) | Neurodivergent-first UI, interaction-preference model, accessibility scaffolding | Recruit, test, co-design, iterate; partner with ND-led orgs | [usability-and-codesign.md](./usability-and-codesign.md) |
| Licensed-clinician escalation staffing | E6, T7, §2.3 | `EscalationService`, `Notifier` interface, panic path, full-context payloads | Staff an on-call human rota; wire a real pager/SMS notifier | [clinical-escalation-staffing.md](./clinical-escalation-staffing.md) |
| Legal review of copy, ToS, ISO posture | CSO §6 | Disclaimers, tiered boundary, consent records, audit trail | Counsel review of all user-facing copy + ToS; pursue ISO 13485/27001 | [legal-and-compliance.md](./legal-and-compliance.md) |
| User Data Trust (legal entity) | H8, §8.3 | `DataTrust` voting + transparent ledger (software substrate) | Form the legal trust, fiduciary governance, revenue-share agreements | [user-data-trust.md](./user-data-trust.md) |
| Production infrastructure | §1.1, T4 | Repository/Notifier/Provider interfaces, secret-sourced keys | Provision PostgreSQL/Redis, secret manager, real model keys, device feeds | [deployment-infrastructure.md](./deployment-infrastructure.md) |

Every other enhancement (all of E1–E7, T1–T8, H1–H7) is implemented in code and
covered by the test suite — see [`docs/TRACEABILITY.md`](../../docs/TRACEABILITY.md).
