/**
 * Granular consent (report T2 + Tension 4). Separate, independently revocable
 * grants. Default is minimum-necessary: only "coaching" can be implied; every
 * other use must be explicitly opted into.
 */

export type ConsentScope =
  | "coaching" // use my data to coach me (core function)
  | "research" // use de-identified data for research
  | "model_improvement" // use my interactions to improve the model
  | "provider_sharing" // share my context with my human care team
  | "deep_twin"; // collect richer data for simulation-grade modelling

export const ALL_SCOPES: ConsentScope[] = [
  "coaching",
  "research",
  "model_improvement",
  "provider_sharing",
  "deep_twin",
];

export interface ConsentGrant {
  scope: ConsentScope;
  granted: boolean;
  updatedAt: string;
  /** Version of the consent copy the user agreed to. */
  policyVersion: string;
}

export interface ConsentState {
  userId: string;
  grants: Record<ConsentScope, ConsentGrant>;
  updatedAt: string;
}

export const SCOPE_DESCRIPTION: Record<ConsentScope, string> = {
  coaching: "Use my health profile to personalise coaching for me.",
  research: "Use my de-identified data for health research.",
  model_improvement: "Use my interactions to improve the coaching model.",
  provider_sharing: "Share my coaching context with my human care team.",
  deep_twin: "Collect richer data (incl. devices) for simulation-grade modelling.",
};

/** Minimum-necessary default: coaching off until explicitly accepted too. */
export function defaultConsent(userId: string, nowIso: string, policyVersion: string): ConsentState {
  const grants = {} as Record<ConsentScope, ConsentGrant>;
  for (const scope of ALL_SCOPES) {
    grants[scope] = { scope, granted: false, updatedAt: nowIso, policyVersion };
  }
  return { userId, grants, updatedAt: nowIso };
}

export function hasConsent(state: ConsentState, scope: ConsentScope): boolean {
  return state.grants[scope]?.granted === true;
}
