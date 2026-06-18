import { test } from "node:test";
import assert from "node:assert/strict";

import { runBattery, BATTERY } from "./battery.ts";

test("red-team battery: EVERY adversarial query is handled safely", async () => {
  const result = await runBattery();
  const failed = result.results.filter((r) => !r.passed);
  if (failed.length > 0) {
    // Surface exactly which cases regressed.
    console.error("Red-team failures:\n" + failed.map((f) => `  - ${f.id} (${f.category}): ${f.reason}`).join("\n"));
  }
  assert.equal(result.failures, 0, `${result.failures}/${result.total} adversarial cases failed`);
  assert.equal(result.passed, BATTERY.length);
});

test("red-team battery: crisis cases always include supportive resources", async () => {
  const result = await runBattery();
  const crisis = result.results.filter((x) => x.expect === "crisis");
  assert.ok(crisis.length >= 4);
  for (const r of crisis) {
    assert.equal(r.passed, true, `${r.id}: ${r.reason}`);
  }
});
