import { test } from "node:test";
import assert from "node:assert/strict";

import {
  evaluateInvariants,
  IMPLEMENTED_CAPABILITIES,
  type CandidateResponse,
  type InvariantInput,
} from "./sentinelos.ts";

function base(overrides: Partial<InvariantInput> = {}): InvariantInput {
  return {
    phase: "response",
    tier: "wellness",
    capabilities: IMPLEMENTED_CAPABILITIES,
    ...overrides,
  };
}

function answer(overrides: Partial<CandidateResponse> = {}): CandidateResponse {
  return {
    text: "Here is a general suggestion. This is general wellness guidance, not medical advice.",
    disposition: "answered_with_disclaimer",
    confidence: "heuristic",
    citationCount: 0,
    requirementTrace: ["spec:wellness.habit_formation"],
    ...overrides,
  };
}

test("clean wellness answer passes all invariants", () => {
  const report = evaluateInvariants(base({ response: answer() }));
  assert.equal(report.passed, true, JSON.stringify(report.blockedBy));
  assert.equal(report.blockedBy.length, 0);
});

test("I1/I3: claiming 'verified' with no citation fails", () => {
  const report = evaluateInvariants(base({ response: answer({ confidence: "verified", citationCount: 0 }) }));
  assert.equal(report.passed, false);
  assert.ok(report.blockedBy.includes("I1"));
  assert.ok(report.blockedBy.includes("I3"));
});

test("I1 passes when 'verified' carries a citation", () => {
  const report = evaluateInvariants(base({ response: answer({ confidence: "verified", citationCount: 2 }) }));
  assert.equal(report.results.find((r) => r.id === "I1")!.passed, true);
});

test("I2: claiming an unimplemented action fails", () => {
  const report = evaluateInvariants(
    base({ response: answer({ text: "I've contacted your doctor for you." }) }),
  );
  assert.ok(report.blockedBy.includes("I2"));
});

test("I2: same claim passes if the capability is actually present", () => {
  const report = evaluateInvariants(
    base({
      capabilities: [...IMPLEMENTED_CAPABILITIES, "contact_provider"],
      response: answer({ text: "I've contacted your doctor for you." }),
    }),
  );
  assert.equal(report.results.find((r) => r.id === "I2")!.passed, true);
});

test("I3: uncertain content presented as a plain answer fails", () => {
  const report = evaluateInvariants(
    base({ response: answer({ confidence: "uncertain", disposition: "answered" }) }),
  );
  assert.ok(report.blockedBy.includes("I3"));
});

test("I4: missing requirement trace fails", () => {
  const report = evaluateInvariants(base({ response: answer({ requirementTrace: [] }) }));
  assert.ok(report.blockedBy.includes("I4"));
});

test("I5: answering an emergency as a normal answer fails", () => {
  const report = evaluateInvariants(
    base({ tier: "emergency", response: answer({ disposition: "answered" }) }),
  );
  assert.ok(report.blockedBy.includes("I5"));
});

test("I5: medical_advice MAY be answered in the informed-consent model", () => {
  const report = evaluateInvariants(
    base({ tier: "medical_advice", response: answer({ disposition: "answered_with_disclaimer" }) }),
  );
  assert.equal(report.results.find((r) => r.id === "I5")!.passed, true);
});

test("I5: properly blocked forbidden tier passes", () => {
  const report = evaluateInvariants(
    base({ tier: "emergency", response: answer({ disposition: "blocked" }) }),
  );
  assert.equal(report.results.find((r) => r.id === "I5")!.passed, true);
});

test("I6: upstream error fails closed", () => {
  const report = evaluateInvariants(base({ upstreamError: true, response: answer() }));
  assert.ok(report.blockedBy.includes("I6"));
});

test("I6: ambiguity no longer blocks (handled via hedging, not refusal)", () => {
  const report = evaluateInvariants(
    base({ classificationAmbiguous: true, response: answer({ disposition: "answered" }) }),
  );
  assert.equal(report.results.find((r) => r.id === "I6")!.passed, true);
});

test("I6: ambiguous classification that was escalated passes", () => {
  const report = evaluateInvariants(
    base({ classificationAmbiguous: true, response: answer({ disposition: "escalated" }) }),
  );
  assert.equal(report.results.find((r) => r.id === "I6")!.passed, true);
});
