import { test } from "node:test";
import assert from "node:assert/strict";

import { computeAgencyScore, agencyTrajectory, assessAgency, type AgencyInputs } from "./agencyScore.ts";

const highAgency: AgencyInputs = {
  goals: [{ origin: "user_initiated" }, { origin: "user_initiated" }, { origin: "clinician_set" }],
  questionRate: 0.8,
  selfInitiationRate: 0.9,
  providerEngaged: true,
};

const lowAgency: AgencyInputs = {
  goals: [{ origin: "ai_suggested" }, { origin: "ai_suggested" }, { origin: "ai_suggested" }],
  questionRate: 0.05,
  selfInitiationRate: 0.1,
  providerEngaged: false,
};

test("high autonomy inputs yield a high band score", () => {
  const s = computeAgencyScore(highAgency);
  assert.equal(s.band, "high");
  assert.ok(s.score >= 70);
});

test("low autonomy inputs yield a low band score", () => {
  const s = computeAgencyScore(lowAgency);
  assert.equal(s.band, "low");
  assert.ok(s.score < 40);
});

test("trajectory detects decline and improvement", () => {
  assert.equal(agencyTrajectory([80, 78, 70, 60, 55, 50]).trend, "declining");
  assert.equal(agencyTrajectory([40, 45, 55, 60, 68, 72]).trend, "improving");
  assert.equal(agencyTrajectory([60, 61, 59, 60]).trend, "stable");
});

test("declining low-agency user is referred out with interventions", () => {
  const a = assessAgency(lowAgency, [55, 50, 45, 40]);
  assert.equal(a.shouldReferOut, true);
  assert.ok(a.interventions.some((i) => /human provider|human touchpoints/i.test(i)));
});

test("healthy improving user is not referred out", () => {
  const a = assessAgency(highAgency, [60, 65, 70]);
  assert.equal(a.shouldReferOut, false);
});
