import { test } from "node:test";
import assert from "node:assert/strict";

import { LightTwin, DeepTwinPlaceholder } from "./twinEngine.ts";
import { computeTwinFidelity } from "./fidelity.ts";
import { emptyProfile } from "../../domain/health.ts";
import { FixedClock } from "../../domain/time.ts";

function richProfile(nowIso: string) {
  const p = emptyProfile("u1", nowIso);
  p.conditions.push({ id: "c1", name: "Hypothyroidism", status: "active", complexity: "moderate", requiresClinicianOversight: false });
  p.medications.push({ id: "m1", name: "Levothyroxine", active: true, schedule: { label: "morning", times: ["08:00"] } });
  p.goals.push({ id: "g1", description: "walk daily", category: "activity", origin: "user_initiated", status: "active", createdAt: nowIso });
  p.careTeam.push({ id: "p1", role: "human_provider", displayName: "Dr Lee", canReceiveShares: true });
  p.allergies.push({ id: "a1", substance: "penicillin", severity: "moderate" });
  return p;
}

test("LightTwin produces transparent insights and is available", () => {
  const twin = new LightTwin();
  const state = twin.model(richProfile("2026-06-17T00:00:00.000Z"));
  assert.equal(state.available, true);
  assert.ok(state.insights.length >= 2);
  assert.ok(state.dataPoints >= 4);
});

test("DeepTwin is honestly unavailable (no phantom simulation)", () => {
  const twin = new DeepTwinPlaceholder();
  const state = twin.model(emptyProfile("u1", "2026-06-17T00:00:00.000Z"));
  assert.equal(state.available, false);
  assert.match(state.unavailableReason ?? "", /not yet implemented/i);
  assert.equal(state.insights.length, 0);
});

test("twin fidelity is low for empty, higher for rich recent profile", () => {
  const clock = new FixedClock("2026-06-17T00:00:00.000Z");
  const empty = computeTwinFidelity(emptyProfile("u1", "2026-06-17T00:00:00.000Z"), clock);
  const rich = computeTwinFidelity(richProfile("2026-06-17T00:00:00.000Z"), clock, { reliableSourceFraction: 0.8, modelConfidence: 0.7 });
  assert.ok(rich.score > empty.score);
  assert.ok(rich.components.completeness > empty.components.completeness);
  assert.match(rich.summary, /Fidelity \d+\/100/);
});

test("twin fidelity recency decays with stale data", () => {
  const clock = new FixedClock("2026-06-17T00:00:00.000Z");
  const stale = richProfile("2026-01-01T00:00:00.000Z"); // ~5.5 months old
  const f = computeTwinFidelity(stale, clock, { reliableSourceFraction: 0.8, modelConfidence: 0.7 });
  assert.ok(f.components.recency <= 0.2);
});
