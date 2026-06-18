import { test } from "node:test";
import assert from "node:assert/strict";

import { CareConstellation, ROLE_PERMISSIONS, canGiveMedicalDirection } from "./careConstellation.ts";
import { exportProfile, importBundle } from "../portability/fhir.ts";
import { emptyProfile } from "../../domain/health.ts";
import { defaultConsent } from "../../domain/consent.ts";
import { isErr, isOk } from "../../domain/result.ts";

test("only human_provider holds medical authority", () => {
  assert.equal(canGiveMedicalDirection("human_provider"), true);
  assert.equal(canGiveMedicalDirection("ai_coach"), false);
  assert.equal(canGiveMedicalDirection("family_caregiver"), false);
  assert.equal(ROLE_PERMISSIONS.ai_coach.authority, "supportive");
  assert.equal(ROLE_PERMISSIONS.human_provider.authority, "medical");
});

test("sharing requires consent + member flag + role permission", () => {
  const cc = new CareConstellation();
  const now = "2026-06-17T00:00:00.000Z";
  const consentOff = defaultConsent("u1", now, "v1");
  const member = { id: "p1", role: "human_provider" as const, displayName: "Dr Lee", canReceiveShares: true };

  assert.ok(isErr(cc.canShareWith(member, consentOff)), "no consent ⇒ blocked");

  const consentOn = defaultConsent("u1", now, "v1");
  consentOn.grants.provider_sharing.granted = true;
  assert.ok(isOk(cc.canShareWith(member, consentOn)));

  // peer_support role cannot receive shared context even with consent
  const peer = { id: "pe", role: "peer_support" as const, displayName: "Sam", canReceiveShares: true };
  assert.ok(isErr(cc.canShareWith(peer, consentOn)));
});

test("FHIR export/import round-trips core profile data", () => {
  const now = "2026-06-17T00:00:00.000Z";
  const p = emptyProfile("u1", now);
  p.displayName = "Alex";
  p.conditions.push({ id: "c1", name: "Hypothyroidism", icd10: "E03.9", status: "active", complexity: "moderate", requiresClinicianOversight: true });
  p.medications.push({ id: "m1", name: "Levothyroxine", active: true, dose: "75mcg" });
  p.goals.push({ id: "g1", description: "walk daily", category: "activity", origin: "user_initiated", status: "active", createdAt: now });

  const bundle = exportProfile(p);
  assert.equal(bundle.resourceType, "Bundle");

  const imported = importBundle(bundle, now);
  assert.ok(isOk(imported));
  if (isOk(imported)) {
    const q = imported.value;
    assert.equal(q.userId, "u1");
    assert.equal(q.displayName, "Alex");
    assert.equal(q.conditions[0]!.name, "Hypothyroidism");
    assert.equal(q.conditions[0]!.requiresClinicianOversight, true);
    assert.equal(q.medications[0]!.name, "Levothyroxine");
    assert.equal(q.medications[0]!.dose, "75mcg");
    assert.equal(q.goals[0]!.origin, "user_initiated");
  }
});

test("importBundle rejects non-bundles", () => {
  assert.ok(isErr(importBundle({ foo: 1 }, "2026-06-17T00:00:00.000Z")));
  assert.ok(isErr(importBundle("nope", "2026-06-17T00:00:00.000Z")));
});
