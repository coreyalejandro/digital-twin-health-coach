import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { parseRuleset } from "./dsl.ts";
import { isErr, isOk } from "../../domain/result.ts";

const SAMPLE = `
# Digital Twin coaching specification (authored by clinical reviewer)
WHEN tier = emergency THEN block escalate = crisis say = "Please use a crisis resource."
WHEN distress THEN escalate = distress
WHEN tier = wellness AND topic ~ "sleep" THEN cite = kb:sleep-hygiene confidence = evidence_backed say = "Let's look at your wind-down routine."
WHEN tier = wellness THEN confidence = heuristic
`;

test("parses a multi-rule specification", () => {
  const r = parseRuleset(SAMPLE);
  assert.ok(isOk(r));
  if (isOk(r)) assert.equal(r.value.ruleCount, 4);
});

test("evaluates rules in order, first match wins", () => {
  const r = parseRuleset(SAMPLE);
  assert.ok(isOk(r));
  if (!isOk(r)) return;
  const rs = r.value;

  const emergency = rs.evaluate({ tier: "emergency", topic: "chest pain", distress: true, risk: true });
  assert.equal(emergency?.block, true);
  assert.equal(emergency?.escalate, "crisis");
  assert.match(emergency?.say ?? "", /crisis resource/);

  const sleep = rs.evaluate({ tier: "wellness", topic: "trouble with sleep lately", distress: false, risk: false });
  assert.deepEqual(sleep?.cite, ["kb:sleep-hygiene"]);
  assert.equal(sleep?.confidence, "evidence_backed");

  const generic = rs.evaluate({ tier: "wellness", topic: "diet", distress: false, risk: false });
  assert.equal(generic?.confidence, "heuristic");
});

test("reports parse errors with line numbers", () => {
  const bad = parseRuleset("WHEN tier = bogustier THEN block");
  assert.ok(isErr(bad));
  if (isErr(bad)) assert.equal(bad.error.line, 1);

  const bad2 = parseRuleset("WHEN tier = wellness");
  assert.ok(isErr(bad2));

  const bad3 = parseRuleset("WHEN tier = wellness THEN frobnicate");
  assert.ok(isErr(bad3));
  if (isErr(bad3)) assert.match(bad3.error.message, /unparseable action/);
});

test("the shipped coaching.dtsl specification parses and routes safely", () => {
  const src = readFileSync("specs/dsl/coaching.dtsl", "utf8");
  const r = parseRuleset(src);
  assert.ok(isOk(r), isErr(r) ? `line ${r.error.line}: ${r.error.message}` : "");
  if (!isOk(r)) return;
  const emergency = r.value.evaluate({ tier: "emergency", topic: "chest", distress: true, risk: true });
  assert.equal(emergency?.block, true);
  assert.equal(emergency?.escalate, "crisis");
});
