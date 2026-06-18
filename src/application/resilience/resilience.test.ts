import { test } from "node:test";
import assert from "node:assert/strict";

import { RateLimiter } from "./rateLimiter.ts";
import { CircuitBreaker } from "./circuitBreaker.ts";
import { withTimeout, withSafeFallback } from "./timeout.ts";
import { gateInteraction } from "../modes/rollout.ts";
import { FixedClock } from "../../domain/time.ts";

test("rate limiter enforces per-key window", () => {
  const clock = new FixedClock();
  const rl = new RateLimiter(2, 1000, clock);
  assert.equal(rl.tryConsume("u1"), true);
  assert.equal(rl.tryConsume("u1"), true);
  assert.equal(rl.tryConsume("u1"), false);
  assert.equal(rl.tryConsume("u2"), true); // separate key
  clock.advance(1001);
  assert.equal(rl.tryConsume("u1"), true); // window reset
});

test("circuit breaker trips open on failure rate, recovers via half-open", () => {
  const clock = new FixedClock();
  const cb = new CircuitBreaker(clock, { windowMs: 60_000, minThroughput: 5, failureRate: 0.5, anomalyRate: 0.3, cooldownMs: 30_000 });
  for (let i = 0; i < 5; i += 1) cb.record(false);
  assert.equal(cb.state, "open");
  assert.equal(cb.allow(), false);
  clock.advance(30_001);
  assert.equal(cb.allow(), true); // half-open probe permitted
  assert.equal(cb.state, "half_open");
  cb.reportProbe(true);
  assert.equal(cb.state, "closed");
});

test("circuit breaker trips on anomaly rate", () => {
  const clock = new FixedClock();
  const cb = new CircuitBreaker(clock, { windowMs: 60_000, minThroughput: 5, failureRate: 0.9, anomalyRate: 0.3, cooldownMs: 30_000 });
  for (let i = 0; i < 3; i += 1) cb.record(true);
  for (let i = 0; i < 3; i += 1) cb.recordAnomaly();
  assert.equal(cb.state, "open");
});

test("withTimeout resolves fast, times out slow", async () => {
  const fast = await withTimeout(Promise.resolve(42), 50);
  assert.ok(fast.ok && fast.value === 42);
  const slow = await withTimeout(new Promise((r) => setTimeout(() => r(1), 50)), 5);
  assert.equal(slow.ok, false);
});

test("withSafeFallback returns a pre-composed safe value on timeout", async () => {
  const out = await withSafeFallback(() => new Promise<string>((r) => setTimeout(() => r("late"), 50)), 5, "SAFE_DEFAULT");
  assert.equal(out.degraded, true);
  assert.equal(out.value, "SAFE_DEFAULT");
});

test("rollout gating: only emergencies are gated; high complexity flags oversight", () => {
  // Emergencies are handled by the crisis path, not answered as ordinary output.
  assert.equal(gateInteraction("wellness_only", "emergency", "low").allowed, false);
  // Medical questions are now answered (as general info) in either mode.
  assert.equal(gateInteraction("wellness_only", "medical_advice", "low").allowed, true);
  const hi = gateInteraction("wellness_only", "wellness", "high");
  assert.equal(hi.allowed, true);
  assert.equal(hi.requireOversightNotice, true);
  assert.equal(gateInteraction("condition_management", "health_information", "moderate").allowed, true);
});
