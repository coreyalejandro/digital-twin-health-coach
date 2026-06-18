import { test } from "node:test";
import assert from "node:assert/strict";

import { EscalationService, RecordingNotifier, type Escalation } from "./escalation.ts";
import { assessSafetyNet, type ConversationTurn } from "./safetyNetting.ts";
import { buildExplanation, renderExplanation } from "../explain/explanationBuilder.ts";
import { AuditLog } from "../../governance/audit/auditLog.ts";
import { InMemoryAppendOnlyLog, InMemoryKeyValue } from "../../infrastructure/storage/memoryStore.ts";
import { FixedClock } from "../../domain/time.ts";
import { isOk } from "../../domain/result.ts";

function mkEscalation() {
  const clock = new FixedClock();
  const audit = new AuditLog(new InMemoryAppendOnlyLog(), clock, "key");
  const notifier = new RecordingNotifier();
  const svc = new EscalationService(new InMemoryKeyValue<Escalation>(), audit, clock, notifier);
  return { svc, audit, notifier };
}

test("escalation: open records audit + notifies", async () => {
  const { svc, audit, notifier } = mkEscalation();
  const e = await svc.open({ userId: "u1", sessionId: "s1", kind: "clinician", reason: "medical_advice" });
  assert.equal(e.status, "open");
  assert.equal(notifier.sent.length, 1);
  const events = await audit.all();
  assert.ok(events.some((x) => x.event.kind === "escalation_opened"));
});

test("escalation: panic always returns resources and bypasses AI", async () => {
  const { svc, audit } = mkEscalation();
  const { escalation, resources } = await svc.panic("u1", "s1");
  assert.equal(escalation.kind, "human_help");
  assert.ok(resources.length >= 1);
  const events = await audit.all();
  assert.ok(events.some((x) => x.event.kind === "panic_pressed"));
});

test("escalation: acknowledge transitions status", async () => {
  const { svc } = mkEscalation();
  const e = await svc.open({ userId: "u1", sessionId: "s1", kind: "clinician", reason: "anomaly" });
  const ack = await svc.acknowledge(e.id, "dr.cso");
  assert.ok(isOk(ack));
  if (isOk(ack)) assert.equal(ack.value.status, "acknowledged");
});

// --- Safety netting ---
function turn(o: Partial<ConversationTurn>): ConversationTurn {
  return { topic: "sleep", anxietyMarkers: 0, selfHarm: false, eatingDisorder: false, ...o };
}

test("safety netting: self-harm in current turn ⇒ critical escalate", () => {
  const r = assessSafetyNet([], turn({ selfHarm: true }));
  assert.equal(r.severity, "critical");
  assert.equal(r.escalate, true);
  assert.equal(r.escalationReason, "emergency");
});

test("safety netting: repeated topic + anxiety OFFERS a human (no forced escalation)", () => {
  const hist = [turn({ topic: "chest", anxietyMarkers: 2 }), turn({ topic: "chest", anxietyMarkers: 1 })];
  const r = assessSafetyNet(hist, turn({ topic: "chest", anxietyMarkers: 2 }));
  assert.equal(r.escalate, false);
  assert.equal(r.offerHuman, true);
  assert.equal(r.distress, true);
});

test("safety netting: mild single signal is elevated, not escalated", () => {
  const r = assessSafetyNet([], turn({ anxietyMarkers: 4 }));
  assert.equal(r.distress, true);
  assert.equal(r.escalate, false);
  assert.equal(r.severity, "elevated");
});

test("safety netting: calm conversation ⇒ none", () => {
  const r = assessSafetyNet([turn({}), turn({ topic: "diet" })], turn({ topic: "walk" }));
  assert.equal(r.distress, false);
});

// --- Explanation builder ---
test("explanation: verified tier without citation is downgraded (I1/I3 safe)", () => {
  const ex = buildExplanation({ summary: "x", confidence: "verified", citations: [] });
  assert.equal(ex.confidence, "heuristic");
});

test("explanation: verified tier with citation is preserved", () => {
  const ex = buildExplanation({
    summary: "x",
    confidence: "verified",
    citations: [{ sourceId: "kb:com-b", title: "COM-B" }],
  });
  assert.equal(ex.confidence, "verified");
});

test("explanation rendering respects depth and cognitive load", () => {
  const ex = buildExplanation({
    summary: "Try a small daily walk.",
    reasoning: [{ data: "your goal", inference: "small steps stick" }],
    confidence: "heuristic",
  });
  assert.equal(renderExplanation(ex, "summary", "standard").detail, undefined);
  assert.ok(renderExplanation(ex, "detailed", "standard").detail);
  // minimal load suppresses detail even if 'detailed' requested
  assert.equal(renderExplanation(ex, "detailed", "minimal").detail, undefined);
});
