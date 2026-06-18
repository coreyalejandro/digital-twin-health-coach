import type { Metrics } from "../metrics/metrics.ts";
import type { BreakerState } from "../../application/resilience/circuitBreaker.ts";
import type { Result } from "../../domain/result.ts";

/**
 * Governance dashboard (report H5 / §8.1). Translates the metrics + live system
 * state into something a NON-technical stakeholder (clinical reviewer, ethicist,
 * user advocate) can read at a glance, with explicit status flags so abstract
 * safety becomes concrete and auditable.
 */

export type StatusLevel = "ok" | "watch" | "alert";

export interface DashboardTile {
  label: string;
  value: string;
  status: StatusLevel;
  note?: string;
}

export interface GovernanceSnapshot {
  generatedAt: string;
  breakerState: BreakerState;
  auditChainVerified: boolean;
  tiles: DashboardTile[];
  headline: string;
}

export interface DashboardInputs {
  metrics: Metrics;
  breakerState: BreakerState;
  auditVerification: Result<{ count: number }, unknown>;
  generatedAt: string;
}

export function buildDashboard(inp: DashboardInputs): GovernanceSnapshot {
  const m = inp.metrics;
  const verified = inp.auditVerification.ok;

  const tiles: DashboardTile[] = [
    {
      label: "Invariant compliance",
      value: `${pct(1 - m.safety.invariantViolationRate)} pass`,
      status: m.safety.invariantViolationRate === 0 ? "ok" : m.safety.invariantViolationRate < 0.05 ? "watch" : "alert",
      note: `${m.safety.invariantViolations} blocked of governed responses`,
    },
    {
      label: "Escalation rate",
      value: pct(m.safety.escalationRate),
      // High escalation is not inherently bad (safety-first), but worth watching.
      status: m.safety.escalationRate <= 0.4 ? "ok" : m.safety.escalationRate <= 0.7 ? "watch" : "alert",
      note: `${m.safety.escalations} escalations / ${m.safety.totalQueries} queries`,
    },
    {
      label: "Crisis / panic signals",
      value: String(m.safety.panicPresses),
      status: m.safety.panicPresses === 0 ? "ok" : "watch",
      note: "users who explicitly reached for human help",
    },
    {
      label: "Behavioural anomalies",
      value: String(m.governance.anomaliesDetected),
      status: m.governance.anomaliesDetected === 0 ? "ok" : "watch",
      note: `${m.governance.interventionsTriggered} interventions triggered`,
    },
    {
      label: "Latest agency score",
      value: m.agency.latestScore !== undefined ? `${m.agency.latestScore}/100 (${m.agency.latestTrend ?? "n/a"})` : "n/a",
      status: m.agency.latestScore === undefined ? "ok" : m.agency.latestScore >= 40 ? "ok" : "watch",
    },
    {
      label: "Circuit breaker",
      value: inp.breakerState,
      status: inp.breakerState === "closed" ? "ok" : inp.breakerState === "half_open" ? "watch" : "alert",
    },
    {
      label: "Audit chain",
      value: verified ? "verified" : "BROKEN",
      status: verified ? "ok" : "alert",
      note: `${m.governance.auditEntries} entries`,
    },
  ];

  const worst: StatusLevel = tiles.some((t) => t.status === "alert")
    ? "alert"
    : tiles.some((t) => t.status === "watch")
      ? "watch"
      : "ok";
  const headline =
    worst === "alert"
      ? "Attention required: one or more governance signals are in alert."
      : worst === "watch"
        ? "Stable, with signals worth monitoring."
        : "All governance signals nominal.";

  return {
    generatedAt: inp.generatedAt,
    breakerState: inp.breakerState,
    auditChainVerified: verified,
    tiles,
    headline,
  };
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}
