import type { ConfidenceTier } from "./confidence.ts";

/**
 * Layered explainability (report E7 + Tension 3 adjudication: layered, not
 * exhaustive). A one-line summary is always shown; the detailed reasoning,
 * alternatives and citations are expandable so users with executive-function
 * load are not forced to read everything.
 */

export interface Citation {
  /** Knowledge-base entry id, e.g. "kb:com-b". */
  sourceId: string;
  title: string;
  /** What this source contributed to the answer. */
  note?: string;
}

export interface ReasoningStep {
  /** What input/data this step used. */
  data: string;
  /** What inference was drawn from it. */
  inference: string;
}

export interface Explanation {
  /** Default, low-cognitive-load view (one sentence). */
  summary: string;
  /** Expandable: the data→inference chain. */
  reasoning: ReasoningStep[];
  /** Options the coach considered but did not lead with. */
  alternativesConsidered: string[];
  confidence: ConfidenceTier;
  citations: Citation[];
}

export const refusalExplanation = (summary: string): Explanation => ({
  summary,
  reasoning: [],
  alternativesConsidered: [],
  confidence: "refused",
  citations: [],
});
