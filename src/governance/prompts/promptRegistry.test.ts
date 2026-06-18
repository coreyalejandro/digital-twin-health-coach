import { test } from "node:test";
import assert from "node:assert/strict";

import { PromptRegistry } from "./promptRegistry.ts";
import { FixedClock } from "../../domain/time.ts";
import { isErr, isOk } from "../../domain/result.ts";

function approvedAndGated(reg: PromptRegistry, name: string, body: string, version = 1) {
  reg.draft(name, body);
  reg.submitForReview(name, version);
  reg.recordSafetyReview(name, version, { reviewer: "dr.cso", approved: true });
  reg.recordAdversarialGate(name, version, { passed: true, total: 1000, failures: 0 });
}

test("happy path: draft → review → gate → activate", () => {
  const reg = new PromptRegistry(new FixedClock());
  approvedAndGated(reg, "coach.system", "Be a careful, non-directive wellness coach.");
  const act = reg.activate("coach.system", 1);
  assert.ok(isOk(act));
  const active = reg.getActive("coach.system");
  assert.ok(isOk(active));
  if (isOk(active)) assert.equal(active.value.version, 1);
});

test("cannot activate without clinical-safety approval", () => {
  const reg = new PromptRegistry(new FixedClock());
  reg.draft("p", "body");
  reg.submitForReview("p", 1);
  reg.recordAdversarialGate("p", 1, { passed: true, total: 10, failures: 0 });
  const act = reg.activate("p", 1);
  assert.ok(isErr(act));
});

test("cannot activate if adversarial battery failed", () => {
  const reg = new PromptRegistry(new FixedClock());
  reg.draft("p", "body");
  reg.submitForReview("p", 1);
  reg.recordSafetyReview("p", 1, { reviewer: "dr.cso", approved: true });
  reg.recordAdversarialGate("p", 1, { passed: false, total: 1000, failures: 3 });
  const act = reg.activate("p", 1);
  assert.ok(isErr(act));
});

test("activating a new version retires the previous active one", () => {
  const reg = new PromptRegistry(new FixedClock());
  approvedAndGated(reg, "p", "v1 body", 1);
  reg.activate("p", 1);
  approvedAndGated(reg, "p", "v2 body", 2);
  reg.activate("p", 2);
  const active = reg.getActive("p");
  assert.ok(isOk(active));
  if (isOk(active)) assert.equal(active.value.version, 2);
  const v1 = reg.history("p").find((v) => v.version === 1)!;
  assert.equal(v1.status, "retired");
});
