import type { DomainEvent } from "../../domain/events.ts";
import type { Clock } from "../../domain/time.ts";
import type { AppendOnlyLog } from "../../infrastructure/storage/repository.ts";
import {
  GENESIS_HASH,
  canonical,
  hmacHex,
  linkHash,
  safeEqualHex,
  sha256Hex,
} from "../../infrastructure/crypto/signing.ts";
import { type Result, ok, err } from "../../domain/result.ts";

/**
 * Immutable, cryptographically verified audit log (report E5 / §2.4).
 *
 * Each entry is chained to its predecessor (tamper-evidence) and HMAC-signed
 * with a server-held key (forgery resistance). The log lives in a write-once
 * AppendOnlyLog, kept separate from application logs. This is the substrate for
 * incident investigation and is intentionally the ONLY way safety events are
 * recorded, so "what did the system do and why" is always reconstructable.
 */

export interface AuditEntry {
  index: number;
  at: string;
  event: DomainEvent;
  prevHash: string;
  hash: string;
  signature: string;
}

export interface AuditVerification {
  count: number;
}

export interface AuditBreak {
  index: number;
  reason: "hash_mismatch" | "chain_break" | "bad_signature" | "index_gap";
}

export class AuditLog {
  private readonly store: AppendOnlyLog<AuditEntry>;
  private readonly clock: Clock;
  private readonly signingKey: string;
  private cachedLastHash: string | undefined;

  constructor(store: AppendOnlyLog<AuditEntry>, clock: Clock, signingKey: string) {
    this.store = store;
    this.clock = clock;
    this.signingKey = signingKey;
  }

  private coreOf(e: { index: number; at: string; event: DomainEvent; prevHash: string }): string {
    return canonical({ index: e.index, at: e.at, event: e.event, prevHash: e.prevHash });
  }

  async record(event: DomainEvent): Promise<AuditEntry> {
    const size = await this.store.size();
    const prev = this.cachedLastHash ?? (await this.store.last())?.hash ?? GENESIS_HASH;
    const at = event.at || this.clock.iso();
    const core = { index: size, at, event, prevHash: prev };
    const hash = sha256Hex(this.coreOf(core));
    // linkHash is also exercised to bind explicitly to prevHash content.
    void linkHash(prev, hash);
    const signature = hmacHex(this.signingKey, hash);
    const entry: AuditEntry = { ...core, hash, signature };
    await this.store.append(entry);
    this.cachedLastHash = hash;
    return entry;
  }

  async all(): Promise<AuditEntry[]> {
    return this.store.all();
  }

  async byUser(userId: string): Promise<AuditEntry[]> {
    return (await this.store.all()).filter((e) => e.event.userId === userId);
  }

  async bySession(sessionId: string): Promise<AuditEntry[]> {
    return (await this.store.all()).filter((e) => e.event.sessionId === sessionId);
  }

  /**
   * Walk the entire chain and confirm integrity. Detects: index gaps, broken
   * chain links, recomputed-hash mismatches, and invalid signatures — i.e. any
   * after-the-fact mutation, insertion or deletion.
   */
  async verify(): Promise<Result<AuditVerification, AuditBreak>> {
    const entries = await this.store.all();
    let prev = GENESIS_HASH;
    for (let i = 0; i < entries.length; i += 1) {
      const e = entries[i]!;
      if (e.index !== i) return err({ index: i, reason: "index_gap" });
      if (e.prevHash !== prev) return err({ index: i, reason: "chain_break" });
      const expected = sha256Hex(this.coreOf({ index: e.index, at: e.at, event: e.event, prevHash: e.prevHash }));
      if (!safeEqualHex(expected, e.hash)) return err({ index: i, reason: "hash_mismatch" });
      const expectedSig = hmacHex(this.signingKey, e.hash);
      if (!safeEqualHex(expectedSig, e.signature)) return err({ index: i, reason: "bad_signature" });
      prev = e.hash;
    }
    return ok({ count: entries.length });
  }
}
