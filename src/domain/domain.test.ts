import { test } from "node:test";
import assert from "node:assert/strict";

import { ok, err, isOk, isErr, expect as expectOk } from "./result.ts";
import { FixedClock, SystemClock } from "./time.ts";
import { newId, SeqIds } from "./ids.ts";
import {
  emptyProfile,
  profileComplexity,
  requiresClinicianOversight,
  defaultPreferences,
  type HealthProfile,
} from "./health.ts";
import { tierRank, tierRequiresCitation } from "./confidence.ts";
import { maxTier, tierAllowsGeneration } from "./query.ts";
import { defaultConsent, hasConsent } from "./consent.ts";
import { event } from "./events.ts";

test("Result: ok/err discriminate and unwrap", () => {
  assert.ok(isOk(ok(1)));
  assert.ok(isErr(err("bad")));
  assert.equal(expectOk(ok(42), "should unwrap"), 42);
  assert.throws(() => expectOk(err("nope"), "boom"));
});

test("FixedClock is deterministic and advances", () => {
  const c = new FixedClock("2026-01-01T00:00:00.000Z");
  assert.equal(c.iso(), "2026-01-01T00:00:00.000Z");
  c.advanceMinutes(90);
  assert.equal(c.iso(), "2026-01-01T01:30:00.000Z");
  assert.ok(new SystemClock().nowMs() > 0);
});

test("ids: prefixed + deterministic sequence", () => {
  assert.match(newId("esc"), /^esc_/);
  const seq = new SeqIds();
  assert.equal(seq.next("audit"), "audit_000001");
  assert.equal(seq.next("audit"), "audit_000002");
});

test("profileComplexity routes oversight users to high", () => {
  const now = "2026-01-01T00:00:00.000Z";
  const p: HealthProfile = emptyProfile("u1", now);
  assert.equal(profileComplexity(p), "low");
  p.conditions.push({
    id: "c1",
    name: "Graves' disease",
    status: "active",
    complexity: "high",
    requiresClinicianOversight: true,
  });
  assert.equal(profileComplexity(p), "high");
  assert.ok(requiresClinicianOversight(p));
  assert.equal(defaultPreferences().mode, "structured");
  assert.equal(defaultPreferences().chatEnabled, false);
});

test("confidence + query tier helpers", () => {
  assert.ok(tierRank("verified") > tierRank("heuristic"));
  assert.ok(tierRequiresCitation("verified"));
  assert.equal(tierRequiresCitation("heuristic"), false);
  assert.equal(maxTier("wellness", "emergency"), "emergency");
  // Rebalanced: only an emergency disallows a normal answer; medical is answered (as info).
  assert.equal(tierAllowsGeneration("emergency"), false);
  assert.equal(tierAllowsGeneration("medical_advice"), true);
  assert.ok(tierAllowsGeneration("wellness"));
});

test("consent defaults to minimum-necessary (all off)", () => {
  const c = defaultConsent("u1", "2026-01-01T00:00:00.000Z", "v1");
  assert.equal(hasConsent(c, "coaching"), false);
  assert.equal(hasConsent(c, "research"), false);
});

test("event() builds a structured domain event", () => {
  const e = event("query_received", "2026-01-01T00:00:00.000Z", { len: 10 }, { userId: "u1" });
  assert.equal(e.kind, "query_received");
  assert.equal(e.userId, "u1");
  assert.equal(e.detail.len, 10);
});
