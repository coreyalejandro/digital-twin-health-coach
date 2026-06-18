import { test } from "node:test";
import assert from "node:assert/strict";

import { DataTrust } from "./dataTrust.ts";
import { FixedClock } from "../../domain/time.ts";
import { isErr, isOk } from "../../domain/result.ts";

function trustWithMembers(n: number) {
  const dt = new DataTrust(new FixedClock(), 0.5);
  for (let i = 0; i < n; i += 1) dt.addMember(`m${i}`);
  return dt;
}

test("proposal passes with quorum and majority", () => {
  const dt = trustWithMembers(4);
  const p = dt.createProposal("Research partnership", "Share de-identified data", "research");
  dt.castVote(p.id, "m0", "for");
  dt.castVote(p.id, "m1", "for");
  dt.castVote(p.id, "m2", "against");
  const t = dt.tally(p.id);
  assert.ok(isOk(t));
  if (isOk(t)) {
    assert.equal(t.value.quorumMet, true); // 3/4 ≥ 0.5
    assert.equal(t.value.outcome, "passed");
  }
  const closed = dt.close(p.id);
  assert.ok(isOk(closed));
  if (isOk(closed)) assert.equal(closed.value.status, "passed");
});

test("no quorum keeps a proposal open", () => {
  const dt = trustWithMembers(10);
  const p = dt.createProposal("Commercial use", "Sell aggregate insights", "model_improvement");
  dt.castVote(p.id, "m0", "for");
  const t = dt.tally(p.id);
  assert.ok(isOk(t));
  if (isOk(t)) {
    assert.equal(t.value.quorumMet, false);
    assert.equal(t.value.outcome, "open");
  }
  assert.ok(isErr(dt.close(p.id)));
});

test("non-members cannot vote; one vote per member", () => {
  const dt = trustWithMembers(3);
  const p = dt.createProposal("X", "y", "research");
  assert.ok(isErr(dt.castVote(p.id, "stranger", "for")));
  dt.castVote(p.id, "m0", "for");
  dt.castVote(p.id, "m0", "against"); // overwrites
  const t = dt.tally(p.id);
  if (isOk(t)) {
    assert.equal(t.value.for, 0);
    assert.equal(t.value.against, 1);
  }
});

test("transparent accounting ledger sums records and revenue", () => {
  const dt = trustWithMembers(2);
  dt.recordUse({ dataUse: "research", recordCount: 100, revenueAttributedUsd: 0, note: "study A" });
  dt.recordUse({ dataUse: "model_improvement", recordCount: 50, revenueAttributedUsd: 250.5 });
  const acc = dt.accounting();
  assert.equal(acc.totalRecordsUsed, 150);
  assert.equal(acc.totalRevenueUsd, 250.5);
  assert.equal(acc.entries.length, 2);
});
