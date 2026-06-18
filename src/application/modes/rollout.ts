import { type QueryTier, tierAllowsGeneration } from "../../domain/query.ts";
import type { Complexity } from "../../domain/health.ts";

/**
 * Staged rollout with differential governance (report Tension 1 adjudication +
 * §10). Two deployment modes deliberately separate lower-risk wellness coaching
 * (faster to ship) from higher-risk condition management (exhaustive
 * validation), so the two are never conflated.
 */

export type RolloutMode = "wellness_only" | "condition_management";

export interface GateResult {
  allowed: boolean;
  reason: string;
  /** Suggest moving to a clinician-supervised track. */
  requireOversightNotice: boolean;
}

export function gateInteraction(mode: RolloutMode, tier: QueryTier, complexity: Complexity): GateResult {
  // Forbidden tiers are never "allowed" to generate regardless of mode (the
  // boundary blocks + escalates them); the gate simply confirms this.
  if (!tierAllowsGeneration(tier)) {
    return {
      allowed: false,
      reason: `tier '${tier}' is handled by the medical boundary (block + escalate)`,
      requireOversightNotice: false,
    };
  }

  if (mode === "wellness_only") {
    // High-complexity users should be steered toward the supervised track.
    const requireOversightNotice = complexity === "high";
    return {
      allowed: true,
      reason:
        complexity === "high"
          ? "wellness coaching permitted, but high complexity warrants the supervised condition-management track"
          : "wellness coaching permitted in wellness-only mode",
      requireOversightNotice,
    };
  }

  // condition_management mode: full coaching, with oversight expected for high complexity.
  return {
    allowed: true,
    reason: "condition-management mode permits coaching across allowed tiers",
    requireOversightNotice: complexity === "high",
  };
}
