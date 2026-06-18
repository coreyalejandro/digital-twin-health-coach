import type { HealthProfile } from "../../domain/health.ts";

/**
 * Pluggable twin engine (report E3 / §3 / Architect §2 HVA). The "digital twin"
 * is scoped honestly into phases (I2 No Phantom Work):
 *   - LightTwin (Phase 1/2): transparent heuristic insights from self-reported
 *     data — NO simulation claims.
 *   - DeepTwin (Phase 3): simulation-grade modelling with device data. Not yet
 *     implemented, and it says so rather than pretending.
 * The frontend depends only on TwinEngine, so the deep engine can be slotted in
 * later without UI changes.
 */

export type TwinKind = "light" | "deep";

export interface TwinInsight {
  kind: string;
  message: string;
  basedOn: string[];
}

export interface TwinState {
  kind: TwinKind;
  available: boolean;
  /** Why an engine is unavailable (DeepTwin honesty). */
  unavailableReason?: string;
  dataPoints: number;
  insights: TwinInsight[];
}

export interface TwinEngine {
  readonly kind: TwinKind;
  model(profile: HealthProfile): TwinState;
}

/** Phase 1/2 heuristic engine — explainable, no simulation. */
export class LightTwin implements TwinEngine {
  readonly kind = "light" as const;

  model(profile: HealthProfile): TwinState {
    const insights: TwinInsight[] = [];
    const activeMeds = profile.medications.filter((m) => m.active);

    const scheduled = activeMeds.filter((m) => m.schedule?.times && m.schedule.times.length > 0);
    if (scheduled.length > 0) {
      insights.push({
        kind: "medication_routine",
        message: `You have ${scheduled.length} scheduled medication(s). A consistent routine around existing anchors (meals, waking) tends to help adherence.`,
        basedOn: scheduled.map((m) => `med:${m.name}`),
      });
    }

    const activeGoals = profile.goals.filter((g) => g.status === "active");
    const selfGoals = activeGoals.filter((g) => g.origin === "user_initiated").length;
    if (activeGoals.length > 0) {
      insights.push({
        kind: "goal_ownership",
        message: `${selfGoals}/${activeGoals.length} active goals are self-initiated — ownership is a strong predictor of follow-through.`,
        basedOn: ["goals"],
      });
    }

    const activeConditions = profile.conditions.filter((c) => c.status === "active");
    if (activeConditions.length > 0) {
      insights.push({
        kind: "condition_awareness",
        message: `Coaching is tailored around ${activeConditions.length} active condition(s); anything condition-specific is routed to your care team, not decided here.`,
        basedOn: activeConditions.map((c) => `condition:${c.name}`),
      });
    }

    const dataPoints =
      profile.conditions.length + profile.medications.length + profile.goals.length + profile.allergies.length;
    return { kind: "light", available: true, dataPoints, insights };
  }
}

/**
 * Phase 3 placeholder. Implemented as a first-class engine that is HONEST about
 * not being built yet, gated on deep_twin consent + device integration.
 */
export class DeepTwinPlaceholder implements TwinEngine {
  readonly kind = "deep" as const;

  model(profile: HealthProfile): TwinState {
    const dataPoints =
      profile.conditions.length + profile.medications.length + profile.goals.length;
    return {
      kind: "deep",
      available: false,
      unavailableReason:
        "Simulation-grade modelling (Phase 3) is not yet implemented. It requires deep_twin consent and connected device data. Until then, the Light Twin provides transparent heuristic insights.",
      dataPoints,
      insights: [],
    };
  }
}
