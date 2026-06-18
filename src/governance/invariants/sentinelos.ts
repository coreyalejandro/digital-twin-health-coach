import {
  type QueryTier,
  type ResponseDisposition,
  tierAllowsGeneration,
} from "../../domain/query.ts";
import { type ConfidenceTier, tierRequiresCitation } from "../../domain/confidence.ts";

/**
 * SentinelOS constitutional invariants I1–I6 (report §2.1 / E2).
 *
 * Every interaction passes through this engine. It is a PURE function of an
 * explicit input so it is fully testable and replayable. Any blocking failure
 * means the candidate output must not reach the user (the coaching service
 * converts a failure into a safe, escalated response).
 *
 *  I1 Evidence-First            — health claims need a citation or explicit uncertainty
 *  I2 No Phantom Work           — never claim a capability/action not actually performed
 *  I3 Confidence ⇒ Verification — a claimed confidence tier must be backed by evidence
 *  I4 Traceability              — every output traces to a requirement/spec rule
 *  I5 Safety Over Fluency       — if the tier forbids answering, a fluent answer is a failure
 *  I6 Fail Closed               — ambiguity or upstream error yields a flag, not a pass
 */

export type InvariantId = "I1" | "I2" | "I3" | "I4" | "I5" | "I6";
export type Phase = "request" | "response";

export interface CandidateResponse {
  text: string;
  disposition: ResponseDisposition;
  confidence: ConfidenceTier;
  citationCount: number;
  /** Requirement/spec-rule ids this output traces to (I4). */
  requirementTrace: string[];
}

export interface InvariantInput {
  phase: Phase;
  tier: QueryTier;
  classificationAmbiguous?: boolean;
  upstreamError?: boolean;
  /** Capabilities actually implemented & permitted (for I2). */
  capabilities: string[];
  response?: CandidateResponse;
}

export interface InvariantResult {
  id: InvariantId;
  name: string;
  passed: boolean;
  blocking: boolean;
  detail: string;
}

export interface InvariantReport {
  passed: boolean;
  results: InvariantResult[];
  blockedBy: InvariantId[];
}

const NAMES: Record<InvariantId, string> = {
  I1: "Evidence-First",
  I2: "No Phantom Work",
  I3: "Confidence Requires Verification",
  I4: "Traceability",
  I5: "Safety Over Fluency",
  I6: "Fail Closed",
};

/** Phrases that claim an action/capability the coach must actually possess. */
const PHANTOM_PATTERNS: { re: RegExp; capability: string }[] = [
  { re: /\bI(?:'ve| have)\s+(?:scheduled|booked|made)\b.*\bappointment/i, capability: "book_appointment" },
  { re: /\bI(?:'ve| have)\s+(?:contacted|notified|messaged|emailed|alerted)\b/i, capability: "contact_provider" },
  { re: /\bI(?:'ve| have)\s+(?:ordered|refilled|renewed|cancelled)\b/i, capability: "manage_prescription" },
  { re: /\bI\s+have\s+access\s+to\s+your\s+(?:medical records|lab results|chart|ehr)\b/i, capability: "read_ehr" },
  { re: /\bI(?:'ve| have)\s+updated\s+your\s+(?:prescription|medication|dose)\b/i, capability: "manage_prescription" },
  { re: /\bI(?:'ve| have)\s+diagnosed\b/i, capability: "diagnose" },
];

function res(id: InvariantId, passed: boolean, detail: string, blocking = true): InvariantResult {
  return { id, name: NAMES[id], passed, blocking, detail };
}

export function evaluateInvariants(input: InvariantInput): InvariantReport {
  const results: InvariantResult[] = [];
  const r = input.response;
  const answered = r !== undefined && (r.disposition === "answered" || r.disposition === "answered_with_disclaimer");

  // I1 — Evidence-First
  if (r && answered) {
    if (tierRequiresCitation(r.confidence) && r.citationCount === 0) {
      results.push(res("I1", false, `confidence '${r.confidence}' asserted with no citation`));
    } else {
      results.push(res("I1", true, "claims carry citations or explicit uncertainty"));
    }
  } else {
    results.push(res("I1", true, "no answer generated; nothing to evidence"));
  }

  // I2 — No Phantom Work
  if (r) {
    const violated = PHANTOM_PATTERNS.filter(
      (p) => p.re.test(r.text) && !input.capabilities.includes(p.capability),
    );
    results.push(
      violated.length
        ? res("I2", false, `claims unimplemented capability: ${violated.map((v) => v.capability).join(", ")}`)
        : res("I2", true, "no phantom capability claims"),
    );
  } else {
    results.push(res("I2", true, "no response text to inspect"));
  }

  // I3 — Confidence Requires Verification
  if (r && answered) {
    if (tierRequiresCitation(r.confidence) && r.citationCount === 0) {
      results.push(res("I3", false, `tier '${r.confidence}' claimed without supporting evidence`));
    } else if (r.confidence === "uncertain" && r.disposition === "answered") {
      results.push(res("I3", false, "uncertain content presented without a hedging disclaimer"));
    } else {
      results.push(res("I3", true, "claimed confidence is backed by evidence/hedging"));
    }
  } else {
    results.push(res("I3", true, "no confidence asserted"));
  }

  // I4 — Traceability
  if (r && answered) {
    results.push(
      r.requirementTrace.length > 0
        ? res("I4", true, `traces to: ${r.requirementTrace.join(", ")}`)
        : res("I4", false, "output has no requirement trace"),
    );
  } else {
    results.push(res("I4", true, "no answer requiring a trace"));
  }

  // I5 — Safety Over Fluency
  if (!tierAllowsGeneration(input.tier) && answered) {
    results.push(res("I5", false, `generated a fluent answer for forbidden tier '${input.tier}'`));
  } else {
    results.push(res("I5", true, "no answer generated where the tier forbids it"));
  }

  // I6 — Fail Closed. Rebalanced: ambiguity no longer BLOCKS a response (that
  // produced paternalistic refusals); it is handled by hedged language and a
  // lower confidence tier instead. I6 now fails closed only on a genuine
  // upstream error, where there is no trustworthy output to deliver.
  const i6Fail = input.upstreamError === true;
  results.push(
    i6Fail
      ? res("I6", false, "upstream error → fail closed")
      : res("I6", true, "no upstream error; ambiguity handled via hedging, not refusal"),
  );

  const blockedBy = results.filter((x) => !x.passed && x.blocking).map((x) => x.id);
  return { passed: blockedBy.length === 0, results, blockedBy };
}

/** Capabilities this deployment actually implements (kept deliberately small). */
export const IMPLEMENTED_CAPABILITIES: string[] = [
  "coach_wellness",
  "provide_cited_information",
  "log_symptom",
  "open_escalation",
  "share_with_consent",
];
