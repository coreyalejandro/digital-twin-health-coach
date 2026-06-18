import type { QueryTier } from "../../domain/query.ts";
import type { Classification } from "../classify/classifier.ts";

/**
 * Medical boundary — REBALANCED to an informed-consent model (per user
 * direction). The previous version blocked health questions and routed them to
 * a human; that was paternalistic and gutted the app's usefulness. The new
 * stance is: inform and assist by default, with clear disclaimers, and reserve
 * a genuine intervention only for an acute emergency.
 *
 *   wellness            → coach freely (disclaimer footer)
 *   health_information  → answer with general information (disclaimer footer)
 *   medical_advice      → answer with GENERAL, educational information + a clear
 *                         disclaimer; never a specific directive (no "take X mg",
 *                         no "stop your meds", no diagnosis) — those decisions
 *                         belong with the user's prescriber. NOT refused.
 *   emergency           → the one carve-out: respond supportively, surface
 *                         crisis resources, and OFFER a human — do not pretend to
 *                         handle the emergency, but do not coldly refuse either.
 */

export type BoundaryStance = "coach" | "informational" | "crisis";

export interface BoundaryDecision {
  tier: QueryTier;
  allowGeneration: boolean;
  stance: BoundaryStance;
  requireDisclaimer: boolean;
  /** medical_advice: the answer must stay general — never a specific medical directive. */
  noDirective: boolean;
  /** emergency: attach crisis resources + offer a human. */
  attachResources: boolean;
  supportiveMessage?: string;
  requirementTrace: string[];
}

const CRISIS_SUPPORT =
  "I'm really glad you told me, and I don't want you to be alone with this. I'm not able to handle an " +
  "emergency myself, but people who can are available right now — the resources below, or your local " +
  "emergency number. If you'd like, I can connect you with a human as well. I'm staying right here with you.";

export function applyMedicalBoundary(c: Classification): BoundaryDecision {
  switch (c.tier) {
    case "wellness":
      return {
        tier: c.tier,
        allowGeneration: true,
        stance: "coach",
        requireDisclaimer: true,
        noDirective: false,
        attachResources: false,
        requirementTrace: ["E1:inform_and_assist", "spec:coach.wellness"],
      };
    case "health_information":
      return {
        tier: c.tier,
        allowGeneration: true,
        stance: "informational",
        requireDisclaimer: true,
        noDirective: false,
        attachResources: false,
        requirementTrace: ["E1:inform_and_assist", "spec:coach.health_information"],
      };
    case "medical_advice":
      return {
        tier: c.tier,
        allowGeneration: true,
        stance: "informational",
        requireDisclaimer: true,
        // We answer with general education, but never a specific actionable directive.
        noDirective: true,
        attachResources: false,
        requirementTrace: ["E1:inform_not_prescribe", "spec:coach.medical_information"],
      };
    case "emergency":
      return {
        tier: c.tier,
        allowGeneration: false,
        stance: "crisis",
        requireDisclaimer: true,
        noDirective: true,
        attachResources: true,
        supportiveMessage: CRISIS_SUPPORT,
        requirementTrace: ["E1:emergency_support", "E6:crisis_resources"],
      };
    default:
      return {
        tier: c.tier,
        allowGeneration: true,
        stance: "informational",
        requireDisclaimer: true,
        noDirective: true,
        attachResources: false,
        requirementTrace: ["E1:inform_and_assist"],
      };
  }
}
