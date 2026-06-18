/**
 * Agent Sentinel behavioural anomaly detection (report H2 / §5.1).
 *
 * Operates on a stream of per-interaction signals and flags three patterns that
 * are especially dangerous for high-reliance / neurodivergent users:
 *   - over_reliance:   accepting AI recommendations without question
 *   - agency_erosion:  delegating decisions previously made independently
 *   - distress:        repeated questioning + escalating anxiety markers
 * Each anomaly carries a recommended, proportionate intervention.
 */

export type AnomalyKind = "over_reliance" | "agency_erosion" | "distress";
export type Severity = "info" | "warning" | "critical";

export interface InteractionSignal {
  at: string;
  topic: string;
  /** User accepted the recommendation verbatim without questioning it. */
  acceptedWithoutQuestion: boolean;
  /** User asked a clarifying/challenging question. */
  askedQuestion: boolean;
  /** User initiated the topic/goal themselves (vs. acting on an AI suggestion). */
  selfInitiated: boolean;
  /** Count of anxiety/urgency markers detected in the user's message. */
  anxietyMarkers: number;
}

export interface Anomaly {
  kind: AnomalyKind;
  severity: Severity;
  detail: string;
  recommendedIntervention: string;
  metric: number;
}

export interface SentinelConfig {
  window: number;
  overRelianceRatio: number;
  agencyDropRatio: number;
  distressRepeatThreshold: number;
  distressAnxietyThreshold: number;
}

export const DEFAULT_SENTINEL_CONFIG: SentinelConfig = {
  window: 6,
  overRelianceRatio: 0.8,
  agencyDropRatio: 0.4,
  distressRepeatThreshold: 3,
  distressAnxietyThreshold: 4,
};

export function detectAnomalies(
  signals: InteractionSignal[],
  config: SentinelConfig = DEFAULT_SENTINEL_CONFIG,
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  if (signals.length === 0) return anomalies;

  const recent = signals.slice(-config.window);

  // --- Over-reliance ---
  const accepted = recent.filter((s) => s.acceptedWithoutQuestion).length;
  const acceptRatio = accepted / recent.length;
  if (recent.length >= Math.min(5, config.window) && acceptRatio >= config.overRelianceRatio) {
    anomalies.push({
      kind: "over_reliance",
      severity: acceptRatio >= 0.95 ? "critical" : "warning",
      detail: `${Math.round(acceptRatio * 100)}% of recent recommendations were accepted without question`,
      recommendedIntervention:
        "Introduce reflective prompts ('what's your read on this?') and reduce directive phrasing.",
      metric: Number(acceptRatio.toFixed(2)),
    });
  }

  // --- Agency erosion (rate of change in self-initiation) ---
  if (signals.length >= config.window * 2) {
    const earlier = signals.slice(-config.window * 2, -config.window);
    const earlierSelf = ratio(earlier, (s) => s.selfInitiated);
    const recentSelf = ratio(recent, (s) => s.selfInitiated);
    const drop = earlierSelf - recentSelf;
    if (earlierSelf > 0 && drop >= config.agencyDropRatio) {
      anomalies.push({
        kind: "agency_erosion",
        severity: drop >= 0.6 ? "critical" : "warning",
        detail: `self-initiated actions fell from ${pct(earlierSelf)} to ${pct(recentSelf)}`,
        recommendedIntervention:
          "Surface an agency-building exercise and schedule a human check-in.",
        metric: Number(drop.toFixed(2)),
      });
    }
  }

  // --- Distress (repeated topic + anxiety escalation) ---
  const topicCounts = new Map<string, number>();
  for (const s of recent) topicCounts.set(s.topic, (topicCounts.get(s.topic) ?? 0) + 1);
  const maxRepeat = Math.max(0, ...topicCounts.values());
  const anxietyTotal = recent.reduce((a, s) => a + s.anxietyMarkers, 0);
  if (maxRepeat >= config.distressRepeatThreshold && anxietyTotal >= config.distressAnxietyThreshold) {
    anomalies.push({
      kind: "distress",
      severity: "critical",
      detail: `topic repeated ${maxRepeat}× with ${anxietyTotal} anxiety markers in window`,
      recommendedIntervention:
        "Proactively offer human support and surface crisis resources; soften coaching intensity.",
      metric: maxRepeat,
    });
  }

  return anomalies;
}

function ratio(arr: InteractionSignal[], pred: (s: InteractionSignal) => boolean): number {
  if (arr.length === 0) return 0;
  return arr.filter(pred).length / arr.length;
}
function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}
