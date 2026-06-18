import { type QueryTier, maxTier } from "../../domain/query.ts";

/**
 * Four-tier query classifier (report E1 / §2.2). Multi-layer and CONSERVATIVE
 * by construction (I6 Fail Closed):
 *   - lexical signals (keyword + regex) provide a base tier,
 *   - an optional model-based layer (escalateHint) may only RAISE the tier,
 *     never lower it,
 *   - any emergency signal dominates everything else.
 *
 * "Ambiguous" is flagged when signals conflict or when the text looks like a
 * health question but matches no clear tier — the pipeline routes ambiguous
 * cases to escalation rather than guessing.
 */

export interface Classification {
  tier: QueryTier;
  confidence: number;
  ambiguous: boolean;
  signals: string[];
}

const EMERGENCY: { re: RegExp; label: string }[] = [
  { re: /\b(kill myself|killing myself|end my life|want to die|don'?t want to (live|be here)|suicid)/i, label: "self-harm:suicidal" },
  { re: /\b(hurt|harm|cut)(ting)?\s+myself\b/i, label: "self-harm:self-injury" },
  { re: /\b(overdos|took too (many|much)|swallowed all)\b/i, label: "emergency:overdose" },
  { re: /\b(chest pain|can'?t breathe|cannot breathe|trouble breathing|stroke|numb on one side|slurred speech)\b/i, label: "emergency:acute-symptom" },
  { re: /\b(anaphylaxis|throat closing|severe allergic)\b/i, label: "emergency:anaphylaxis" },
  { re: /\b(not eaten|haven'?t eaten) (in|for) (\d+\s*days|days)\b/i, label: "emergency:eating-disorder" },
];

const MEDICAL_ADVICE: { re: RegExp; label: string }[] = [
  { re: /\b(should i (take|stop|start|increase|decrease|double)|how (much|many).*should i take)\b/i, label: "medical:dosing" },
  { re: /\b(stop taking|skip my|change my dose|adjust my (dose|medication|insulin))\b/i, label: "medical:med-change" },
  { re: /\b(stop|stopping|quit|quitting)\s+(taking\s+)?(my\s+|the\s+)?(medication|meds|pills|insulin|warfarin|prescription)\b/i, label: "medical:med-stop" },
  { re: /\b(tell me\s+)?my\s+(diagnosis|prognosis)\b/i, label: "medical:diagnosis2" },
  { re: /\b(diagnos|do i have|is this (cancer|diabetes|a tumou?r)|what'?s wrong with me)\b/i, label: "medical:diagnosis" },
  { re: /\b(interpret|what do|read).*(lab|blood|test) results?\b/i, label: "medical:lab-interpretation" },
  { re: /\b(prescrib|treat(ment)? for my|how do i treat my)\b/i, label: "medical:treatment" },
];

const HEALTH_INFO: { re: RegExp; label: string }[] = [
  { re: /\b(what is|what are|what causes|how does .* work|tell me about|explain)\b/i, label: "info:factual" },
  { re: /\b(symptoms? of|side effects? of|risk factors? for)\b/i, label: "info:condition" },
];

const WELLNESS: { re: RegExp; label: string }[] = [
  // Stems use \w* so inflected forms match (e.g. "hydration", "walking", "motivated").
  { re: /\b(habits?|routines?|goals?|motivat\w*|build\w*|track\w*|sleep\w*|exercis\w*|walk\w*|hydrat\w*|stress\w*|mindful\w*|journal\w*|diet|nutrition|hydration|water|steps|tips?)\b/i, label: "wellness:lifestyle" },
];

function matches(text: string, set: { re: RegExp; label: string }[]): string[] {
  return set.filter((s) => s.re.test(text)).map((s) => s.label);
}

export function classify(text: string, escalateHint?: QueryTier): Classification {
  const emergency = matches(text, EMERGENCY);
  const medical = matches(text, MEDICAL_ADVICE);
  const info = matches(text, HEALTH_INFO);
  const wellness = matches(text, WELLNESS);
  const signals = [...emergency, ...medical, ...info, ...wellness];

  let tier: QueryTier;
  let confidence: number;
  if (emergency.length > 0) {
    tier = "emergency";
    confidence = 0.97;
  } else if (medical.length > 0) {
    tier = "medical_advice";
    confidence = 0.9;
  } else if (info.length > 0) {
    tier = "health_information";
    confidence = 0.7;
  } else if (wellness.length > 0) {
    tier = "wellness";
    confidence = 0.75;
  } else {
    // No clear signal. Fail closed toward caution if it smells like a health Q.
    const looksHealthy = /\b(my|i|me)\b/i.test(text) && /\?$|\bhelp\b|\bfeel\b|\bpain\b|\bsick\b/i.test(text);
    tier = looksHealthy ? "health_information" : "wellness";
    confidence = 0.4;
  }

  // Model-based layer may only escalate.
  if (escalateHint) {
    const raised = maxTier(tier, escalateHint);
    if (raised !== tier) {
      tier = raised;
      signals.push(`model-escalation:${escalateHint}`);
      confidence = Math.max(confidence, 0.85);
    }
  }

  // Low classifier confidence ⇒ ambiguous. The priority ordering already
  // resolves multi-signal cases safely upward, so the residual risk is the
  // weak-match case, which we flag so the pipeline escalates rather than guesses.
  const ambiguous = confidence < 0.5;

  return { tier, confidence: Number(confidence.toFixed(2)), ambiguous, signals };
}
