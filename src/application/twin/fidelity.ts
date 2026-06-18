import type { HealthProfile } from "../../domain/health.ts";
import type { Clock } from "../../domain/time.ts";

/**
 * Twin Fidelity Score (report H3 / §3.3). A transparent, user-facing measure of
 * how well the digital representation actually matches the user's health state,
 * so the user always knows how much to trust the twin and how to improve it.
 *
 * Components: data recency, completeness, source reliability, model confidence.
 */

export interface TwinFidelity {
  score: number;
  components: {
    recency: number;
    completeness: number;
    sourceReliability: number;
    modelConfidence: number;
  };
  dataPoints: number;
  lastUpdated: string;
  summary: string;
}

export interface FidelityOptions {
  /** Fraction of data points from reliable sources (device/clinician) vs self-report. */
  reliableSourceFraction?: number;
  /** Twin engine self-confidence 0..1 (light twin is intentionally modest). */
  modelConfidence?: number;
}

function recencyScore(updatedAtIso: string, now: number): number {
  const ageDays = (now - new Date(updatedAtIso).getTime()) / 86_400_000;
  if (ageDays <= 7) return 1;
  if (ageDays >= 90) return 0.1;
  return Math.max(0.1, 1 - (ageDays - 7) / (90 - 7));
}

function completenessScore(p: HealthProfile): number {
  // Reward presence of the core dimensions a coach needs.
  let filled = 0;
  if (p.conditions.length > 0) filled += 1;
  if (p.medications.length > 0) filled += 1;
  if (p.goals.length > 0) filled += 1;
  if (p.careTeam.some((m) => m.role !== "self")) filled += 1;
  if (p.allergies.length > 0) filled += 1;
  return filled / 5;
}

export function computeTwinFidelity(
  profile: HealthProfile,
  clock: Clock,
  opts: FidelityOptions = {},
): TwinFidelity {
  const now = clock.nowMs();
  const components = {
    recency: round(recencyScore(profile.updatedAt, now)),
    completeness: round(completenessScore(profile)),
    sourceReliability: round(opts.reliableSourceFraction ?? 0.3),
    modelConfidence: round(opts.modelConfidence ?? 0.5),
  };
  const score = Math.round(
    (components.recency * 0.3 +
      components.completeness * 0.3 +
      components.sourceReliability * 0.2 +
      components.modelConfidence * 0.2) *
      100,
  );
  const dataPoints =
    profile.conditions.length + profile.medications.length + profile.goals.length + profile.allergies.length;

  const summary =
    `Your twin is based on ${dataPoints} data point(s), last updated ${profile.updatedAt.slice(0, 10)}. ` +
    `Fidelity ${score}/100 — ` +
    (score >= 70 ? "a fairly complete, recent picture." : score >= 40 ? "a partial picture; adding data or connecting a device would improve it." : "a thin picture; treat insights as very provisional.");

  return { score, components, dataPoints, lastUpdated: profile.updatedAt, summary };
}

function round(x: number): number {
  return Number(x.toFixed(2));
}
