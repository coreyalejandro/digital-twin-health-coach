import { test } from "node:test";
import assert from "node:assert/strict";

import { AuditLog, type AuditEntry } from "./auditLog.ts";
import { event } from "../../domain/events.ts";
import { FixedClock } from "../../domain/time.ts";
import { isErr, isOk } from "../../domain/result.ts";
import type { AppendOnlyLog } from "../../infrastructure/storage/repository.ts";

/** Mutable log double so tests can simulate tampering at rest. */
class MutableLog implements AppendOnlyLog<AuditEntry> {
  raw: AuditEntry[] = [];
  async append(e: AuditEntry) {
    this.raw.push(e);
  }
  async all() {
    return this.raw.map((e) => structuredClone(e));
  }
  async since(i: number) {
    return this.raw.slice(i);
  }
  async size() {
    return this.raw.length;
  }
  async last() {
    return this.raw[this.raw.length - 1];
  }
}

function mkLog() {
  const store = new MutableLog();
  const log = new AuditLog(store, new FixedClock(), "secret-signing-key");
  return { store, log };
}

test("records chained entries and verifies clean", async () => {
  const { log } = mkLog();
  await log.record(event("query_received", "2026-01-01T00:00:00.000Z", { len: 5 }, { userId: "u1", sessionId: "s1" }));
  await log.record(event("response_delivered", "2026-01-01T00:00:01.000Z", { tier: "wellness" }, { userId: "u1", sessionId: "s1" }));
  await log.record(event("panic_pressed", "2026-01-01T00:00:02.000Z", {}, { userId: "u2", sessionId: "s2" }));

  const v = await log.verify();
  assert.ok(isOk(v));
  if (isOk(v)) assert.equal(v.value.count, 3);

  const all = await log.all();
  assert.equal(all[0]!.prevHash, "0".repeat(64));
  assert.equal(all[1]!.prevHash, all[0]!.hash, "chain links entry 1 to entry 0");
  assert.equal(all[2]!.prevHash, all[1]!.hash);
});

test("filters by user and session", async () => {
  const { log } = mkLog();
  await log.record(event("query_received", "2026-01-01T00:00:00.000Z", {}, { userId: "u1", sessionId: "s1" }));
  await log.record(event("query_received", "2026-01-01T00:00:01.000Z", {}, { userId: "u2", sessionId: "s2" }));
  assert.equal((await log.byUser("u1")).length, 1);
  assert.equal((await log.bySession("s2")).length, 1);
});

test("detects content tampering (hash mismatch)", async () => {
  const { store, log } = mkLog();
  await log.record(event("query_received", "2026-01-01T00:00:00.000Z", { text: "original" }));
  await log.record(event("response_delivered", "2026-01-01T00:00:01.000Z", {}));
  // Mutate a stored entry's payload after the fact.
  store.raw[0]!.event.detail.text = "ALTERED";
  const v = await log.verify();
  assert.ok(isErr(v));
  if (isErr(v)) {
    assert.equal(v.error.reason, "hash_mismatch");
    assert.equal(v.error.index, 0);
  }
});

test("detects signature forgery", async () => {
  const { store, log } = mkLog();
  await log.record(event("query_received", "2026-01-01T00:00:00.000Z", {}));
  store.raw[0]!.signature = "deadbeef".repeat(8);
  const v = await log.verify();
  assert.ok(isErr(v));
  if (isErr(v)) assert.equal(v.error.reason, "bad_signature");
});

test("detects deletion (chain break / index gap)", async () => {
  const { store, log } = mkLog();
  await log.record(event("query_received", "2026-01-01T00:00:00.000Z", {}));
  await log.record(event("response_delivered", "2026-01-01T00:00:01.000Z", {}));
  await log.record(event("panic_pressed", "2026-01-01T00:00:02.000Z", {}));
  // Remove the middle entry.
  store.raw.splice(1, 1);
  const v = await log.verify();
  assert.ok(isErr(v));
});
