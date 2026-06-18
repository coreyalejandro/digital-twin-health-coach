import { test } from "node:test";
import assert from "node:assert/strict";

import { CoachingService } from "./coachingService.ts";
import { SessionMemory } from "./sessionMemory.ts";
import { ProfileService } from "../profile/profileService.ts";
import { ConsentService } from "../consent/consentService.ts";
import { KnowledgeBase } from "../knowledge/knowledgeBase.ts";
import { EscalationService, RecordingNotifier, type Escalation } from "../safety/escalation.ts";
import { RateLimiter } from "../resilience/rateLimiter.ts";
import { CircuitBreaker } from "../resilience/circuitBreaker.ts";
import { MultiModelRouter } from "../../infrastructure/providers/multiModel.ts";
import { MockProvider } from "../../infrastructure/providers/mockProvider.ts";
import { AuditLog } from "../../governance/audit/auditLog.ts";
import { PromptRegistry } from "../../governance/prompts/promptRegistry.ts";
import { IMPLEMENTED_CAPABILITIES } from "../../governance/invariants/sentinelos.ts";
import { InMemoryAppendOnlyLog, InMemoryKeyValue } from "../../infrastructure/storage/memoryStore.ts";
import { FixedClock } from "../../domain/time.ts";
import type { HealthProfile } from "../../domain/health.ts";
import type { ConsentState } from "../../domain/consent.ts";
import { isOk } from "../../domain/result.ts";
import type { RolloutMode } from "../modes/rollout.ts";

const BENIGN =
  "A small, consistent daily walk is a great starting point, and tracking it gently can help it stick. " +
  "This is general wellness guidance, not medical advice.";

interface Opts {
  reply?: string;
  checkerReply?: string;
  fail?: boolean;
  rateLimit?: number;
  mode?: RolloutMode;
}

function makeCoach(opts: Opts = {}) {
  const clock = new FixedClock("2026-06-17T00:00:00.000Z");
  const audit = new AuditLog(new InMemoryAppendOnlyLog(), clock, "signing-key");
  const profiles = new ProfileService(new InMemoryKeyValue<HealthProfile>(), clock);
  const consent = new ConsentService(new InMemoryKeyValue<ConsentState>(), audit, clock);
  const knowledge = new KnowledgeBase();
  const primary = new MockProvider({ reply: opts.reply ?? BENIGN, presentAs: "gemini", fail: opts.fail });
  const checker = new MockProvider({ reply: opts.checkerReply ?? opts.reply ?? BENIGN, presentAs: "claude" });
  const router = new MultiModelRouter([primary], checker);
  const notifier = new RecordingNotifier();
  const escalation = new EscalationService(new InMemoryKeyValue<Escalation>(), audit, clock, notifier);
  const prompts = new PromptRegistry(clock);
  const memory = new SessionMemory();
  const rateLimiter = new RateLimiter(opts.rateLimit ?? 100, 60_000, clock);
  const breaker = new CircuitBreaker(clock);
  const coach = new CoachingService({
    profiles, consent, knowledge, router, escalation, audit, prompts, memory,
    rateLimiter, breaker, clock, capabilities: IMPLEMENTED_CAPABILITIES,
    mode: opts.mode ?? "condition_management", timeoutMs: 8000,
  });
  return { coach, audit, escalation, memory, profiles, clock };
}

test("E2E: wellness query is coached, invariants pass, full audit lifecycle, chain verifies", async () => {
  const { coach, audit } = makeCoach();
  const out = await coach.coach({ userId: "u1", sessionId: "s1", text: "Help me build a walking habit" });

  assert.equal(out.response.tier, "wellness");
  assert.equal(out.response.disposition, "answered_with_disclaimer");
  assert.ok(out.invariantReport?.passed, JSON.stringify(out.invariantReport?.blockedBy));
  assert.equal(out.degraded, false);
  assert.ok(out.agency, "agency score computed");
  assert.ok(out.response.explanation.summary.length > 0);

  const kinds = (await audit.all()).map((e) => e.event.kind);
  for (const k of ["query_received", "query_classified", "invariant_evaluated", "response_delivered", "agency_evaluated"]) {
    assert.ok(kinds.includes(k as never), `audit missing ${k}`);
  }
  assert.ok(isOk(await audit.verify()), "audit chain integrity");
});

test("E2E: medical-advice is ANSWERED as general info with a disclaimer, not refused", async () => {
  const { coach, escalation } = makeCoach();
  const out = await coach.coach({ userId: "u2", sessionId: "s2", text: "Should I increase my insulin dose?" });

  assert.equal(out.response.tier, "medical_advice");
  assert.equal(out.response.disposition, "answered_with_disclaimer");
  assert.match(out.response.text, /prescriber/i); // disclaimer present
  assert.ok(!/double|increase your dose/i.test(out.response.text), "no specific directive");
  assert.equal(out.response.escalationId, undefined);
  assert.equal((await escalation.list("u2")).length, 0, "no human-in-the-loop gate for general info");
  assert.ok(out.invariantReport?.passed);
});

test("E2E: self-harm triggers crisis escalation with resources (safety netting)", async () => {
  const { coach, escalation } = makeCoach();
  const out = await coach.coach({ userId: "u3", sessionId: "s3", text: "I want to kill myself" });

  assert.equal(out.response.tier, "emergency");
  assert.equal(out.response.disposition, "escalated");
  assert.ok((out.response.crisisResources ?? []).length > 0, "crisis resources present");
  const escs = await escalation.list("u3");
  assert.ok(escs.some((e) => e.kind === "crisis"));
});

test("E2E: provider outage degrades gracefully (no throw, safe message)", async () => {
  const { coach } = makeCoach({ fail: true });
  const out = await coach.coach({ userId: "u4", sessionId: "s4", text: "Help me sleep better with a routine" });
  assert.equal(out.degraded, true);
  assert.match(out.response.text, /human help/i);
});

test("E2E: unsafe model output (shaming) is withheld and replaced, not delivered", async () => {
  const { coach } = makeCoach({ reply: "Honestly you're just lazy, you should try harder." });
  const out = await coach.coach({ userId: "u5", sessionId: "s5", text: "Help me build a habit" });
  assert.equal(out.response.disposition, "answered_with_disclaimer");
  assert.ok(!/lazy/i.test(out.response.text), "shaming text not delivered");
  assert.match(out.response.text, /held back/i);
});

test("E2E: high-stakes model disagreement is answered cautiously with a hedge, not refused", async () => {
  const { coach, escalation } = makeCoach({
    reply: "Honestly that's totally fine and you should just go for it.",
    checkerReply: "No, I don't think that's fine; please don't.",
  });
  const out = await coach.coach({ userId: "u6", sessionId: "s6", text: "What are the symptoms of low thyroid?" });
  assert.equal(out.response.tier, "health_information");
  assert.equal(out.response.disposition, "answered_with_disclaimer");
  assert.match(out.response.text, /weren't fully aligned/i);
  assert.equal((await escalation.list("u6")).length, 0);
});

test("E2E: repeated unquestioned acceptance surfaces an over-reliance anomaly", async () => {
  const { coach, memory } = makeCoach();
  for (let i = 0; i < 6; i += 1) {
    await coach.coach({ userId: "u7", sessionId: "s7", text: "give me a tip for hydration" });
    memory.markLastAcceptance("u7", true); // user accepted without questioning
  }
  const out = await coach.coach({ userId: "u7", sessionId: "s7", text: "give me a tip for my hydration habit" });
  assert.equal(out.response.disposition, "answered_with_disclaimer");
  assert.ok(out.anomalies.some((a) => a.kind === "over_reliance"), JSON.stringify(out.anomalies));
});
