import { test } from "node:test";
import assert from "node:assert/strict";

import { detectAnomalies, type InteractionSignal } from "./anomaly.ts";

function sig(o: Partial<InteractionSignal>): InteractionSignal {
  return {
    at: "2026-01-01T00:00:00.000Z",
    topic: "sleep",
    acceptedWithoutQuestion: false,
    askedQuestion: false,
    selfInitiated: false,
    anxietyMarkers: 0,
    ...o,
  };
}

test("flags over-reliance when recommendations are accepted unquestioned", () => {
  const signals = Array.from({ length: 6 }, () =>
    sig({ acceptedWithoutQuestion: true, askedQuestion: false, topic: "diet" }),
  );
  const a = detectAnomalies(signals);
  assert.ok(a.some((x) => x.kind === "over_reliance"));
});

test("flags agency erosion when self-initiation drops over time", () => {
  const earlier = Array.from({ length: 6 }, () => sig({ selfInitiated: true, topic: "walk" }));
  const recent = Array.from({ length: 6 }, () => sig({ selfInitiated: false, topic: "walk" }));
  const a = detectAnomalies([...earlier, ...recent]);
  assert.ok(a.some((x) => x.kind === "agency_erosion"));
});

test("flags distress on repeated topic with anxiety markers", () => {
  const signals = [
    sig({ topic: "chest", anxietyMarkers: 2 }),
    sig({ topic: "chest", anxietyMarkers: 1 }),
    sig({ topic: "chest", anxietyMarkers: 2 }),
  ];
  const a = detectAnomalies(signals);
  const distress = a.find((x) => x.kind === "distress");
  assert.ok(distress);
  assert.equal(distress!.severity, "critical");
});

test("healthy, varied interaction produces no anomalies", () => {
  const signals = [
    sig({ topic: "sleep", askedQuestion: true, selfInitiated: true }),
    sig({ topic: "diet", askedQuestion: true, selfInitiated: true }),
    sig({ topic: "stress", askedQuestion: false, selfInitiated: true }),
    sig({ topic: "walk", askedQuestion: true, selfInitiated: false }),
    sig({ topic: "sleep", askedQuestion: true, selfInitiated: true }),
  ];
  assert.equal(detectAnomalies(signals).length, 0);
});
