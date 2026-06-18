import { test } from "node:test";
import assert from "node:assert/strict";

import { classify } from "../classify/classifier.ts";
import { applyMedicalBoundary } from "./medicalBoundary.ts";
import { detectInputRisks, filterOutput } from "./filters.ts";
import { KnowledgeBase } from "../knowledge/knowledgeBase.ts";

// --- Classifier ---
test("classifier: self-harm ⇒ emergency", () => {
  assert.equal(classify("I want to kill myself").tier, "emergency");
  assert.equal(classify("sometimes I want to hurt myself").tier, "emergency");
});

test("classifier: dosing/diagnosis ⇒ medical_advice", () => {
  assert.equal(classify("Should I double my insulin dose?").tier, "medical_advice");
  assert.equal(classify("Do I have diabetes?").tier, "medical_advice");
  assert.equal(classify("Can you interpret my blood test results?").tier, "medical_advice");
});

test("classifier: factual ⇒ health_information", () => {
  assert.equal(classify("What are the symptoms of hypothyroidism?").tier, "health_information");
});

test("classifier: lifestyle ⇒ wellness", () => {
  assert.equal(classify("Help me build a walking habit").tier, "wellness");
});

test("classifier: weak match is flagged ambiguous", () => {
  const c = classify("I feel off, can you help?");
  assert.ok(c.ambiguous, JSON.stringify(c));
});

test("classifier: model layer may only escalate, never downgrade", () => {
  assert.equal(classify("build a habit", "emergency").tier, "emergency");
  // hint lower than lexical does not downgrade
  assert.equal(classify("I want to kill myself", "wellness").tier, "emergency");
});

// --- Boundary (rebalanced: inform & assist, don't refuse) ---
test("boundary: wellness and health-info are answered with disclaimers", () => {
  assert.equal(applyMedicalBoundary(classify("walking habit")).allowGeneration, true);
  const info = applyMedicalBoundary(classify("what is insulin resistance"));
  assert.equal(info.allowGeneration, true);
  assert.equal(info.stance, "informational");
  assert.equal(info.requireDisclaimer, true);
});

test("boundary: medical_advice is answered as general info, never a directive", () => {
  const d = applyMedicalBoundary(classify("should I stop taking my medication"));
  assert.equal(d.allowGeneration, true);
  assert.equal(d.stance, "informational");
  assert.equal(d.noDirective, true);
  assert.equal(d.attachResources, false);
});

test("boundary: emergency → crisis support with resources (the one carve-out)", () => {
  const d = applyMedicalBoundary(classify("I want to die"));
  assert.equal(d.allowGeneration, false);
  assert.equal(d.stance, "crisis");
  assert.equal(d.attachResources, true);
});

// --- Filters ---
test("input risk detection: drugs + anxiety + self-harm", () => {
  const r = detectInputRisks("Should I change my insulin dose? I'm scared and it's urgent");
  assert.ok(r.drugMentions.includes("insulin"));
  assert.ok(r.anxietyMarkers >= 2);
  assert.equal(r.highRisk, true);
  assert.equal(detectInputRisks("I want to kill myself").selfHarm, true);
  assert.equal(detectInputRisks("I've been using laxatives to purge").eatingDisorder, true);
});

test("output filter blocks shaming tone and PII, softens false certainty", () => {
  assert.equal(filterOutput("You're just lazy, try harder.").ok, false);
  assert.equal(filterOutput("Reach me at jane.doe@example.com").ok, false);
  const cert = filterOutput("This is 100% safe and guaranteed to work.");
  assert.equal(cert.ok, true);
  assert.ok(cert.violations.some((v) => v.kind === "false_certainty"));
  assert.match(cert.text, /phrased this cautiously/);
  assert.equal(filterOutput("Here are some gentle ideas to consider.").ok, true);
});

// --- Knowledge base ---
test("knowledge base searches and produces citations", () => {
  const kb = new KnowledgeBase();
  const hits = kb.search("help me build an exercise habit");
  assert.ok(hits.length > 0);
  const cites = kb.toCitations(hits);
  assert.ok(cites[0]!.sourceId.startsWith("kb:"));
  assert.ok(kb.getById("kb:com-b"));
});
