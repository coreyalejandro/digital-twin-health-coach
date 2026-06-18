/**
 * Health domain model — the structured representation a real "coach" must hold
 * in order to be more than a stateless chatbot (addresses report E3/T2: a coach
 * without memory of conditions, medications and goals is just a search engine).
 *
 * All identifiers are opaque strings; clinical codes (ICD-10 / RxNorm) are
 * optional so the model degrades gracefully for self-reported data.
 */

export type ConditionStatus = "active" | "in_remission" | "resolved";
export type Complexity = "low" | "moderate" | "high";
export type AllergySeverity = "mild" | "moderate" | "severe";

/** Provenance of a goal — central to the Health Agency Score (report H4). */
export type GoalOrigin = "user_initiated" | "ai_suggested" | "clinician_set";
export type GoalStatus = "proposed" | "active" | "achieved" | "abandoned";

/** Roles in the Care Constellation (report H6). */
export type CareRole =
  | "self"
  | "ai_coach"
  | "human_provider"
  | "family_caregiver"
  | "peer_support";

/** Neurodivergent-first interaction surfaces (report E4/4.1). Chat is NOT default. */
export type InteractionMode = "structured" | "visual_schedule" | "voice" | "chat";
export type CognitiveLoad = "minimal" | "standard" | "detailed";
export type ExplanationDepth = "summary" | "detailed";

export interface Condition {
  id: string;
  name: string;
  icd10?: string;
  status: ConditionStatus;
  complexity: Complexity;
  /** True when autonomous AI coaching is inappropriate without clinician oversight. */
  requiresClinicianOversight: boolean;
  diagnosedOn?: string;
  notes?: string;
}

export interface MedicationSchedule {
  /** Free-form human label, e.g. "twice daily with food". */
  label: string;
  /** 24h times of day, e.g. ["08:00","20:00"], used by the visual schedule. */
  times?: string[];
}

export interface Medication {
  id: string;
  name: string;
  rxnorm?: string;
  dose?: string;
  route?: string;
  schedule?: MedicationSchedule;
  active: boolean;
  startedOn?: string;
}

export interface Allergy {
  id: string;
  substance: string;
  reaction?: string;
  severity: AllergySeverity;
}

export interface Goal {
  id: string;
  description: string;
  category: string;
  origin: GoalOrigin;
  status: GoalStatus;
  createdAt: string;
  targetDate?: string;
  measure?: string;
}

export interface CareTeamMember {
  id: string;
  role: CareRole;
  displayName: string;
  relationship?: string;
  /** Whether the user has consented to share coaching context with this member. */
  canReceiveShares: boolean;
  contact?: string;
}

export interface InteractionPreferences {
  mode: InteractionMode;
  cognitiveLoad: CognitiveLoad;
  explanationDepth: ExplanationDepth;
  /** Disable open-ended chat entirely (some users find it harmful/overwhelming). */
  chatEnabled: boolean;
  /** Reduce motion / announce all transitions (cognitive accessibility). */
  announceTransitions: boolean;
}

export const defaultPreferences = (): InteractionPreferences => ({
  // Per report 4.1: chat is available but NOT the default; structured wins.
  mode: "structured",
  cognitiveLoad: "standard",
  explanationDepth: "summary",
  chatEnabled: false,
  announceTransitions: true,
});

export interface HealthProfile {
  userId: string;
  displayName?: string;
  conditions: Condition[];
  medications: Medication[];
  allergies: Allergy[];
  goals: Goal[];
  careTeam: CareTeamMember[];
  preferences: InteractionPreferences;
  createdAt: string;
  updatedAt: string;
}

export const emptyProfile = (userId: string, nowIso: string): HealthProfile => ({
  userId,
  conditions: [],
  medications: [],
  allergies: [],
  goals: [],
  careTeam: [{ id: "self", role: "self", displayName: "You", canReceiveShares: true }],
  preferences: defaultPreferences(),
  createdAt: nowIso,
  updatedAt: nowIso,
});

/**
 * Overall complexity of a user's health situation. Drives capability routing
 * (report CSO §4): high-complexity / oversight-required users are steered away
 * from autonomous AI coaching toward supervised care.
 */
export function profileComplexity(p: HealthProfile): Complexity {
  const active = p.conditions.filter((c) => c.status === "active");
  if (active.some((c) => c.requiresClinicianOversight) || active.length >= 3) {
    return "high";
  }
  if (active.some((c) => c.complexity === "high")) return "high";
  if (active.length >= 1 || p.medications.filter((m) => m.active).length >= 2) {
    return "moderate";
  }
  return "low";
}

export function requiresClinicianOversight(p: HealthProfile): boolean {
  return p.conditions.some(
    (c) => c.status === "active" && c.requiresClinicianOversight,
  );
}
