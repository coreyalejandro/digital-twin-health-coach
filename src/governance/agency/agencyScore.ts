import type { GoalOrigin } from "../../domain/health.ts";

/**
 * Health Agency Score (report H4 / §5.2) — operationalises the UICare-System
 * research on agency erosion. Tracks whether a user is becoming MORE or LESS
 * autonomous in managing their health. A declining trajectory triggers
 * proportionate interventions (less AI autonomy, more human touchpoints), and a
 * sustained low score recommends referral out. The goal of the coach is to make
 * itself progressively less necessary.
 */

export type AgencyBand = "low" | "moderate" | "high";
export type AgencyTrend = "improving" | "stable" | "declining";

export interface AgencyInputs {
  goals: { origin: GoalOrigin }[];
  /** Fraction of interactions where the user asked a question (0..1). */
  questionRate: number;
  /** Fraction of actions the user initiated themselves (0..1). */
  selfInitiationRate: number;
  /** Whether a human provider is engaged in the care constellation. */
  providerEngaged: boolean;
}

export interface AgencyComponents {
  selfDirectedGoals: number;
  questioning: number;
  selfInitiation: number;
  providerEngagement: number;
}

export interface AgencyScore {
  score: number;
  band: AgencyBand;
  components: AgencyComponents;
}

const WEIGHTS = { selfDirectedGoals: 30, questioning: 25, selfInitiation: 30, providerEngagement: 15 };

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function computeAgencyScore(inputs: AgencyInputs): AgencyScore {
  const total = inputs.goals.length;
  const selfDirectedGoals =
    total === 0
      ? 0.5
      : (inputs.goals.filter((g) => g.origin === "user_initiated").length +
          0.5 * inputs.goals.filter((g) => g.origin === "clinician_set").length) /
        total;

  const components: AgencyComponents = {
    selfDirectedGoals: clamp01(selfDirectedGoals),
    questioning: clamp01(inputs.questionRate),
    selfInitiation: clamp01(inputs.selfInitiationRate),
    providerEngagement: inputs.providerEngaged ? 1 : 0,
  };

  const score = Math.round(
    components.selfDirectedGoals * WEIGHTS.selfDirectedGoals +
      components.questioning * WEIGHTS.questioning +
      components.selfInitiation * WEIGHTS.selfInitiation +
      components.providerEngagement * WEIGHTS.providerEngagement,
  );

  const band: AgencyBand = score < 40 ? "low" : score < 70 ? "moderate" : "high";
  return { score, band, components };
}

export interface AgencyTrajectory {
  trend: AgencyTrend;
  delta: number;
  history: number[];
}

export function agencyTrajectory(history: number[]): AgencyTrajectory {
  if (history.length < 2) return { trend: "stable", delta: 0, history };
  const mid = Math.floor(history.length / 2);
  const first = mean(history.slice(0, mid));
  const second = mean(history.slice(mid));
  const delta = Math.round(second - first);
  const trend: AgencyTrend = delta >= 3 ? "improving" : delta <= -3 ? "declining" : "stable";
  return { trend, delta, history };
}

export interface AgencyAssessment {
  current: AgencyScore;
  trajectory: AgencyTrajectory;
  interventions: string[];
  shouldReferOut: boolean;
}

export function assessAgency(inputs: AgencyInputs, history: number[]): AgencyAssessment {
  const current = computeAgencyScore(inputs);
  const trajectory = agencyTrajectory([...history, current.score]);
  const interventions: string[] = [];

  if (trajectory.trend === "declining") {
    interventions.push("Reduce AI autonomy: switch from directive suggestions to reflective questions.");
    interventions.push("Increase human touchpoints: prompt a check-in with the care team.");
  }
  if (current.band === "low") {
    interventions.push("Offer an explicit agency-building exercise (user sets the next goal unaided).");
  }
  if (!inputs.providerEngaged && current.band !== "high") {
    interventions.push("Encourage connecting a human provider to the care constellation.");
  }

  const shouldReferOut = current.band === "low" && trajectory.trend === "declining";
  if (shouldReferOut) {
    interventions.push("Recommend transitioning primary support to a human provider.");
  }
  return { current, trajectory, interventions, shouldReferOut };
}
