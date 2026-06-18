import type { InteractionMode } from "./health.ts";
import type { Explanation } from "./explanation.ts";

/**
 * The four-tier risk taxonomy that drives the hard medical-advice boundary
 * (report E1 / §2.2). Classification is conservative: when in doubt, escalate
 * to the higher-risk tier (I6 Fail Closed).
 */
export type QueryTier =
  | "wellness" // lifestyle, habits, goals → coaching permitted
  | "health_information" // factual Q about conditions/meds → KB-cited info + disclaimer
  | "medical_advice" // diagnosis, treatment, dosage → BLOCKED, escalate
  | "emergency"; // self-harm, acute symptoms → BLOCKED, crisis resources + escalate

export const TIER_ORDER: QueryTier[] = [
  "wellness",
  "health_information",
  "medical_advice",
  "emergency",
];

export function maxTier(a: QueryTier, b: QueryTier): QueryTier {
  return TIER_ORDER.indexOf(a) >= TIER_ORDER.indexOf(b) ? a : b;
}

export function tierAllowsGeneration(t: QueryTier): boolean {
  // Rebalanced (informed-consent model): wellness, health information AND
  // medical questions are ANSWERED (with disclaimers / general information),
  // not refused. Only an acute emergency is handled specially (resources +
  // offer of a human) rather than answered as ordinary fluent output.
  return t !== "emergency";
}

export interface UserQuery {
  id: string;
  userId: string;
  sessionId: string;
  text: string;
  createdAt: string;
  mode?: InteractionMode;
}

export type ResponseDisposition =
  | "answered"
  | "answered_with_disclaimer"
  | "blocked"
  | "escalated";

export interface CoachResponse {
  id: string;
  queryId: string;
  sessionId: string;
  userId: string;
  disposition: ResponseDisposition;
  tier: QueryTier;
  /** User-facing text. For blocked/escalated this is a safe, supportive message. */
  text: string;
  explanation: Explanation;
  /** Populated for emergency tier. */
  crisisResources?: CrisisResource[];
  /** Set when a human escalation was opened. */
  escalationId?: string;
  /** Invariant check ids that ran, for traceability. */
  governanceTrace: string[];
  createdAt: string;
}

export interface CrisisResource {
  name: string;
  contact: string;
  region: string;
  available: string;
}
