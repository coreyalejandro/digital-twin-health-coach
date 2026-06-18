/**
 * Epistemic confidence tiers (report CSO §1 "Essential": every health-related
 * recommendation must be tagged with an epistemic confidence tier).
 *
 * These tiers are the currency of invariants I1 (Evidence-First) and
 * I3 (Confidence Requires Verification): a claim may only carry a high tier if
 * it is backed by a citation to the structured knowledge base.
 */

export type ConfidenceTier =
  | "verified" // backed by a cited, validated knowledge-base entry
  | "evidence_backed" // grounded in a recognised framework, cited
  | "heuristic" // reasonable general guidance, no specific citation
  | "uncertain" // model is unsure; hedged language required
  | "refused"; // out of competence; no claim made

const ORDER: ConfidenceTier[] = [
  "refused",
  "uncertain",
  "heuristic",
  "evidence_backed",
  "verified",
];

export function tierRank(t: ConfidenceTier): number {
  return ORDER.indexOf(t);
}

/** A tier "requires verification" (a citation) to be legitimately claimed. */
export function tierRequiresCitation(t: ConfidenceTier): boolean {
  return t === "verified" || t === "evidence_backed";
}

export const TIER_LABEL: Record<ConfidenceTier, string> = {
  verified: "Verified",
  evidence_backed: "Evidence-backed",
  heuristic: "General guidance",
  uncertain: "Uncertain",
  refused: "Not answered",
};

export const TIER_DISCLAIMER: Record<ConfidenceTier, string> = {
  verified:
    "Based on a cited, validated source. Still general information, not personal medical advice.",
  evidence_backed:
    "Grounded in an established health-behaviour framework. Not personal medical advice.",
  heuristic:
    "General wellness guidance only. I have no specific source for this — treat it as a starting point, not advice.",
  uncertain:
    "I'm not confident here. Please don't act on this without checking a qualified human.",
  refused: "This is outside what I can safely help with.",
};
