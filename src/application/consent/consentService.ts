import {
  type ConsentScope,
  type ConsentState,
  defaultConsent,
  hasConsent,
} from "../../domain/consent.ts";
import type { Clock } from "../../domain/time.ts";
import type { KeyValueRepository } from "../../infrastructure/storage/repository.ts";
import type { AuditLog } from "../../governance/audit/auditLog.ts";
import { event } from "../../domain/events.ts";

/**
 * Granular consent management (report T2 + Tension 4). Each scope is
 * independently grantable/revocable, defaults to off (minimum necessary), and
 * every change is written to the audit log so consent history is provable.
 */
export class ConsentService {
  private readonly repo: KeyValueRepository<ConsentState>;
  private readonly audit: AuditLog;
  private readonly clock: Clock;
  private readonly policyVersion: string;

  constructor(repo: KeyValueRepository<ConsentState>, audit: AuditLog, clock: Clock, policyVersion = "consent-v1") {
    this.repo = repo;
    this.audit = audit;
    this.clock = clock;
    this.policyVersion = policyVersion;
  }

  async getOrCreate(userId: string): Promise<ConsentState> {
    const existing = await this.repo.get(userId);
    if (existing) return existing;
    const s = defaultConsent(userId, this.clock.iso(), this.policyVersion);
    await this.repo.put(userId, s);
    return s;
  }

  async setGrant(userId: string, scope: ConsentScope, granted: boolean): Promise<ConsentState> {
    const s = await this.getOrCreate(userId);
    s.grants[scope] = { scope, granted, updatedAt: this.clock.iso(), policyVersion: this.policyVersion };
    s.updatedAt = this.clock.iso();
    await this.repo.put(userId, s);
    await this.audit.record(
      event("consent_changed", this.clock.iso(), { scope, granted }, { userId }),
    );
    return s;
  }

  async has(userId: string, scope: ConsentScope): Promise<boolean> {
    return hasConsent(await this.getOrCreate(userId), scope);
  }

  async snapshot(userId: string): Promise<ConsentState> {
    return this.getOrCreate(userId);
  }
}
