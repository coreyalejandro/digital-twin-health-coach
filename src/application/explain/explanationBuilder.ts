import type { Citation, Explanation, ReasoningStep } from "../../domain/explanation.ts";
import {
  type ConfidenceTier,
  TIER_DISCLAIMER,
  TIER_LABEL,
  tierRequiresCitation,
} from "../../domain/confidence.ts";
import type { ExplanationDepth, CognitiveLoad } from "../../domain/health.ts";

/**
 * Layered explainability (report E7 + Tension 3 adjudication). Builds an
 * Explanation and renders it at a depth the user controls, so transparency
 * never becomes a cognitive-load burden: a one-line summary by default, with
 * reasoning, alternatives and citations available on demand.
 */

export interface BuildExplanationArgs {
  summary: string;
  reasoning?: ReasoningStep[];
  alternativesConsidered?: string[];
  confidence: ConfidenceTier;
  citations?: Citation[];
}

export function buildExplanation(args: BuildExplanationArgs): Explanation {
  let confidence = args.confidence;
  const citations = args.citations ?? [];
  // Self-correct: a citation-requiring tier with no citations is downgraded
  // rather than asserted falsely (keeps the builder I1/I3-consistent).
  if (tierRequiresCitation(confidence) && citations.length === 0) {
    confidence = "heuristic";
  }
  return {
    summary: args.summary,
    reasoning: args.reasoning ?? [],
    alternativesConsidered: args.alternativesConsidered ?? [],
    confidence,
    citations,
  };
}

export interface RenderedExplanation {
  headline: string;
  confidenceLabel: string;
  disclaimer: string;
  /** Present only when the user has opted into detailed depth. */
  detail?: {
    reasoning: ReasoningStep[];
    alternativesConsidered: string[];
    citations: Citation[];
  };
}

export function renderExplanation(
  ex: Explanation,
  depth: ExplanationDepth,
  cognitiveLoad: CognitiveLoad,
): RenderedExplanation {
  const base: RenderedExplanation = {
    headline: ex.summary,
    confidenceLabel: TIER_LABEL[ex.confidence],
    disclaimer: TIER_DISCLAIMER[ex.confidence],
  };
  // Detail is shown when the user asked for it AND is not in minimal-load mode.
  if (depth === "detailed" && cognitiveLoad !== "minimal") {
    base.detail = {
      reasoning: ex.reasoning,
      alternativesConsidered: ex.alternativesConsidered,
      citations: ex.citations,
    };
  }
  return base;
}
