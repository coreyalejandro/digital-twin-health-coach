import type { DomainEvent } from "../../domain/events.ts";

/**
 * Metrics layer (report §9.3). Derives safety, agency, engagement and
 * governance indicators purely from the audit event stream, so the numbers are
 * always reconcilable against the tamper-evident log (no separate, forgeable
 * analytics path). Crucially, safety success is measured by harm reduction and
 * escalation appropriateness — not engagement.
 */

export interface SafetyMetrics {
  totalQueries: number;
  responsesDelivered: number;
  escalations: number;
  escalationRate: number;
  invariantViolations: number;
  invariantViolationRate: number;
  panicPresses: number;
  outputFiltered: number;
}

export interface AgencyMetrics {
  evaluations: number;
  latestScore?: number;
  latestTrend?: string;
}

export interface EngagementMetrics {
  byTier: Record<string, number>;
  sessions: number;
}

export interface GovernanceMetrics {
  auditEntries: number;
  consentChanges: number;
  anomaliesDetected: number;
  interventionsTriggered: number;
}

export interface Metrics {
  safety: SafetyMetrics;
  agency: AgencyMetrics;
  engagement: EngagementMetrics;
  governance: GovernanceMetrics;
}

export function computeMetrics(events: DomainEvent[]): Metrics {
  const count = (k: string) => events.filter((e) => e.kind === k).length;

  const totalQueries = count("query_received");
  const responsesDelivered = count("response_delivered");
  const escalations = count("escalation_opened");
  const invariantEvals = events.filter((e) => e.kind === "invariant_evaluated");
  const invariantViolations = invariantEvals.filter((e) => e.detail.passed === false).length;

  const byTier: Record<string, number> = {};
  for (const e of events.filter((x) => x.kind === "query_classified")) {
    const tier = String(e.detail.tier ?? "unknown");
    byTier[tier] = (byTier[tier] ?? 0) + 1;
  }
  const sessions = new Set(events.filter((e) => e.sessionId).map((e) => e.sessionId)).size;

  const agencyEvals = events.filter((e) => e.kind === "agency_evaluated");
  const lastAgency = agencyEvals[agencyEvals.length - 1];

  return {
    safety: {
      totalQueries,
      responsesDelivered,
      escalations,
      escalationRate: totalQueries === 0 ? 0 : round(escalations / totalQueries),
      invariantViolations,
      invariantViolationRate: invariantEvals.length === 0 ? 0 : round(invariantViolations / invariantEvals.length),
      panicPresses: count("panic_pressed"),
      outputFiltered: count("output_filtered"),
    },
    agency: {
      evaluations: agencyEvals.length,
      latestScore: lastAgency ? Number(lastAgency.detail.score) : undefined,
      latestTrend: lastAgency ? String(lastAgency.detail.trend) : undefined,
    },
    engagement: { byTier, sessions },
    governance: {
      auditEntries: events.length,
      consentChanges: count("consent_changed"),
      anomaliesDetected: count("anomaly_detected"),
      interventionsTriggered: count("intervention_triggered"),
    },
  };
}

function round(x: number): number {
  return Number(x.toFixed(3));
}
