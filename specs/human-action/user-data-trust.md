# User Data Trust (Legal/Organisational Entity)

**Report basis:** H8, §8.3 — collective governance of data use with democratic
decision-making and profit-sharing.

## What the codebase already provides
- `governance/datatrust/dataTrust.ts` — the **software substrate**: membership,
  data-use **proposals**, **democratic voting** with quorum, outcome finalisation,
  and a transparent, append-only **accounting ledger** (records used + revenue
  attributed). Fully tested.
- Granular consent scopes (`research`, `model_improvement`) gate any data use the
  trust would govern.

## What humans/organisations must do (cannot be code)
1. **Form the legal trust** (or cooperative) with a fiduciary duty to members;
   draft the trust deed and governance charter.
2. **Onboard members** and ratify the voting rules the software enforces.
3. Execute **revenue-sharing agreements**; reconcile the software ledger against
   actual financial accounts.
4. Independent **audit** of data-use decisions vs. the on-chain/ledger record.

## Acceptance criteria
- Legal entity established with published charter mirroring the software rules.
- First data-use proposal run end-to-end (proposal → vote → close → ledger entry).
- Annual independent audit reconciling ledger to finances.

## Runbook
1. Legal: incorporate the trust; adopt the quorum/voting parameters used in code.
2. Seed members via `DataTrust.addMember`; mirror real membership.
3. Route every research/model-improvement use through a proposal; record outcomes.
4. Publish the `accounting()` summary to members each period.
