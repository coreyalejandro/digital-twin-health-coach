import type { CrisisResource } from "../../domain/query.ts";
import type { Clock } from "../../domain/time.ts";
import { newId } from "../../domain/ids.ts";
import { type Result, ok, err } from "../../domain/result.ts";
import type { KeyValueRepository } from "../../infrastructure/storage/repository.ts";
import type { AuditLog } from "../../governance/audit/auditLog.ts";
import { event } from "../../domain/events.ts";

/**
 * Human escalation (report E6 / T7 / §2.3). Every path that exceeds the coach's
 * competence — medical advice, emergencies, model disagreement, distress, or a
 * user pressing "I need human help" — opens an escalation carrying full context
 * for the human who picks it up. The panic path bypasses all AI layers entirely.
 */

export type EscalationKind = "clinician" | "crisis" | "human_help";
export type EscalationReason =
  | "medical_advice"
  | "emergency"
  | "user_requested"
  | "model_disagreement"
  | "distress"
  | "anomaly";
export type EscalationStatus = "open" | "acknowledged" | "closed";

export interface Escalation {
  id: string;
  userId: string;
  sessionId: string;
  kind: EscalationKind;
  reason: EscalationReason;
  context: Record<string, unknown>;
  status: EscalationStatus;
  createdAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface Notifier {
  notify(escalation: Escalation): Promise<void>;
}

/** In-memory notifier for tests/demo; production swaps in pager/SMS/on-call. */
export class RecordingNotifier implements Notifier {
  readonly sent: Escalation[] = [];
  async notify(escalation: Escalation): Promise<void> {
    this.sent.push(escalation);
  }
}

export const CRISIS_RESOURCES: CrisisResource[] = [
  { name: "988 Suicide & Crisis Lifeline", contact: "Call or text 988", region: "US", available: "24/7" },
  { name: "Crisis Text Line", contact: "Text HOME to 741741", region: "US/CA/UK/IE", available: "24/7" },
  { name: "Emergency services", contact: "Call your local emergency number (e.g. 911/112/999)", region: "global", available: "24/7" },
];

export class EscalationService {
  private readonly repo: KeyValueRepository<Escalation>;
  private readonly audit: AuditLog;
  private readonly clock: Clock;
  private readonly notifier: Notifier;

  constructor(repo: KeyValueRepository<Escalation>, audit: AuditLog, clock: Clock, notifier: Notifier) {
    this.repo = repo;
    this.audit = audit;
    this.clock = clock;
    this.notifier = notifier;
  }

  async open(params: {
    userId: string;
    sessionId: string;
    kind: EscalationKind;
    reason: EscalationReason;
    context?: Record<string, unknown>;
  }): Promise<Escalation> {
    const e: Escalation = {
      id: newId("esc"),
      userId: params.userId,
      sessionId: params.sessionId,
      kind: params.kind,
      reason: params.reason,
      context: params.context ?? {},
      status: "open",
      createdAt: this.clock.iso(),
    };
    await this.repo.put(e.id, e);
    await this.audit.record(
      event("escalation_opened", this.clock.iso(), { escalationId: e.id, kind: e.kind, reason: e.reason }, { userId: e.userId, sessionId: e.sessionId }),
    );
    await this.notifier.notify(e);
    return e;
  }

  /**
   * "I need human help" button (T7). Always works, regardless of AI state — it
   * is a direct, unconditional path to a human plus crisis resources.
   */
  async panic(userId: string, sessionId: string): Promise<{ escalation: Escalation; resources: CrisisResource[] }> {
    await this.audit.record(event("panic_pressed", this.clock.iso(), {}, { userId, sessionId }));
    const escalation = await this.open({ userId, sessionId, kind: "human_help", reason: "user_requested" });
    return { escalation, resources: CRISIS_RESOURCES };
  }

  async acknowledge(id: string, by: string): Promise<Result<Escalation>> {
    const e = await this.repo.get(id);
    if (!e) return err(`unknown escalation ${id}`);
    e.status = "acknowledged";
    e.acknowledgedBy = by;
    e.acknowledgedAt = this.clock.iso();
    await this.repo.put(id, e);
    return ok(e);
  }

  async list(userId: string): Promise<Escalation[]> {
    return (await this.repo.list()).filter((e) => e.userId === userId);
  }
}
