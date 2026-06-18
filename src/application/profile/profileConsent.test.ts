import { test } from "node:test";
import assert from "node:assert/strict";

import { ProfileService } from "./profileService.ts";
import { ConsentService } from "../consent/consentService.ts";
import { AuditLog } from "../../governance/audit/auditLog.ts";
import { InMemoryAppendOnlyLog, InMemoryKeyValue } from "../../infrastructure/storage/memoryStore.ts";
import { FixedClock } from "../../domain/time.ts";
import type { HealthProfile } from "../../domain/health.ts";
import type { ConsentState } from "../../domain/consent.ts";

test("ProfileService creates, mutates, and computes complexity", async () => {
  const svc = new ProfileService(new InMemoryKeyValue<HealthProfile>(), new FixedClock());
  const p = await svc.getOrCreate("u1");
  assert.equal(p.userId, "u1");
  assert.equal(await svc.complexity("u1"), "low");

  await svc.addCondition("u1", {
    name: "Graves' disease",
    status: "active",
    complexity: "high",
    requiresClinicianOversight: true,
  });
  assert.equal(await svc.complexity("u1"), "high");
  assert.equal(await svc.needsOversight("u1"), true);

  await svc.addGoal("u1", { description: "walk daily", category: "activity", origin: "user_initiated", status: "active" });
  const after = await svc.get("u1");
  assert.equal(after!.goals.length, 1);
  assert.match(after!.goals[0]!.id, /^goal_/);
});

test("ConsentService defaults off, records changes to audit", async () => {
  const clock = new FixedClock();
  const audit = new AuditLog(new InMemoryAppendOnlyLog(), clock, "k");
  const svc = new ConsentService(new InMemoryKeyValue<ConsentState>(), audit, clock);
  assert.equal(await svc.has("u1", "coaching"), false);
  await svc.setGrant("u1", "coaching", true);
  assert.equal(await svc.has("u1", "coaching"), true);
  assert.equal(await svc.has("u1", "research"), false);
  const events = await audit.all();
  assert.ok(events.some((e) => e.event.kind === "consent_changed"));
});
