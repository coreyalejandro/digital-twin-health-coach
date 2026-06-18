/**
 * Domain events. Every safety-relevant action emits one; the audit log
 * (governance/audit) signs and chains them so the full lifecycle of an
 * interaction is reconstructable for incident investigation (report E5).
 */

export type EventKind =
  | "session_started"
  | "query_received"
  | "query_classified"
  | "invariant_evaluated"
  | "input_filtered"
  | "output_filtered"
  | "response_blocked"
  | "escalation_opened"
  | "response_delivered"
  | "anomaly_detected"
  | "intervention_triggered"
  | "consent_changed"
  | "agency_evaluated"
  | "panic_pressed"
  | "prompt_activated"
  | "data_exported"
  | "data_imported"
  | "twin_updated"
  | "circuit_tripped"
  | "provider_disagreement";

export interface DomainEvent {
  kind: EventKind;
  at: string;
  userId?: string;
  sessionId?: string;
  queryId?: string;
  /** Structured, JSON-serialisable detail. Must never contain raw secrets. */
  detail: Record<string, unknown>;
}

export function event(
  kind: EventKind,
  at: string,
  detail: Record<string, unknown> = {},
  ctx: { userId?: string; sessionId?: string; queryId?: string } = {},
): DomainEvent {
  return { kind, at, detail, ...ctx };
}
