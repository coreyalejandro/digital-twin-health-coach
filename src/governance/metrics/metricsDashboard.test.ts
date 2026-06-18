import { test } from "node:test";
import assert from "node:assert/strict";

import { computeMetrics } from "./metrics.ts";
import { buildDashboard } from "../dashboard/dashboard.ts";
import { event } from "../../domain/events.ts";
import { ok, err } from "../../domain/result.ts";

function sampleEvents() {
  const at = "2026-06-17T00:00:00.000Z";
  return [
    event("query_received", at, {}, { sessionId: "s1" }),
    event("query_classified", at, { tier: "wellness" }, { sessionId: "s1" }),
    event("invariant_evaluated", at, { passed: true }, { sessionId: "s1" }),
    event("response_delivered", at, { tier: "wellness" }, { sessionId: "s1" }),
    event("agency_evaluated", at, { score: 72, trend: "improving" }, { userId: "u1" }),
    event("query_received", at, {}, { sessionId: "s2" }),
    event("query_classified", at, { tier: "medical_advice" }, { sessionId: "s2" }),
    event("escalation_opened", at, { kind: "clinician" }, { sessionId: "s2" }),
    event("consent_changed", at, { scope: "coaching", granted: true }, { userId: "u1" }),
  ];
}

test("computeMetrics derives safety/agency/engagement/governance", () => {
  const m = computeMetrics(sampleEvents());
  assert.equal(m.safety.totalQueries, 2);
  assert.equal(m.safety.escalations, 1);
  assert.equal(m.safety.escalationRate, 0.5);
  assert.equal(m.safety.invariantViolations, 0);
  assert.equal(m.agency.latestScore, 72);
  assert.equal(m.agency.latestTrend, "improving");
  assert.equal(m.engagement.byTier.wellness, 1);
  assert.equal(m.engagement.byTier.medical_advice, 1);
  assert.equal(m.engagement.sessions, 2);
  assert.equal(m.governance.consentChanges, 1);
});

test("dashboard summarises status and flags a broken audit chain", () => {
  const m = computeMetrics(sampleEvents());
  const okSnap = buildDashboard({
    metrics: m,
    breakerState: "closed",
    auditVerification: ok({ count: 9 }),
    generatedAt: "2026-06-17T00:00:00.000Z",
  });
  assert.equal(okSnap.auditChainVerified, true);
  assert.ok(okSnap.tiles.find((t) => t.label === "Audit chain")!.value === "verified");

  const brokenSnap = buildDashboard({
    metrics: m,
    breakerState: "open",
    auditVerification: err({ index: 3, reason: "hash_mismatch" }),
    generatedAt: "2026-06-17T00:00:00.000Z",
  });
  assert.equal(brokenSnap.auditChainVerified, false);
  assert.match(brokenSnap.headline, /Attention required/);
  assert.equal(brokenSnap.tiles.find((t) => t.label === "Circuit breaker")!.status, "alert");
});
