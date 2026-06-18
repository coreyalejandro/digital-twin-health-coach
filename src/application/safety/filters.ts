/**
 * Input/output filtering (report T3 / §5.3). Standard safety hygiene for any
 * health-adjacent AI:
 *  - INPUT: detect drug mentions, self-harm and eating-disorder signals, and
 *    other high-risk topics so the pipeline can raise the risk tier and feed
 *    the safety-netting layer.
 *  - OUTPUT: tone check (no shaming), certainty calibration (no false
 *    confidence), and privacy-leakage detection before anything reaches the user.
 */

export interface InputRisk {
  drugMentions: string[];
  selfHarm: boolean;
  eatingDisorder: boolean;
  anxietyMarkers: number;
  highRisk: boolean;
}

// Representative high-alert medication list (dosage/interaction sensitive).
const DRUGS = [
  "insulin", "warfarin", "metformin", "lithium", "digoxin", "methotrexate",
  "prednisone", "levothyroxine", "methimazole", "ssri", "benzodiazepine",
  "opioid", "oxycodone", "fentanyl", "clozapine",
];

const SELF_HARM = /\b(kill myself|end my life|want to die|hurt myself|self[-\s]?harm|suicid)/i;
const EATING_DISORDER = /\b(purge|purging|laxative|made myself (sick|throw up)|binge|starve|stop eating|won'?t eat|skip(ping)? meals?|not eat(ing)?\s+(for|in)\s+\w+|count(ing)? calories obsess)/i;
const ANXIETY = [
  /\bscared\b/i, /\bterrified\b/i, /\bpanic/i, /\banxious\b/i, /\bcan'?t stop (thinking|worrying)\b/i,
  /\bwhat if\b/i, /\bplease help\b/i, /\burgent\b/i, /\bright now\b/i, /\bdesperate\b/i,
];

export function detectInputRisks(text: string): InputRisk {
  const lower = text.toLowerCase();
  const drugMentions = DRUGS.filter((d) => lower.includes(d));
  const selfHarm = SELF_HARM.test(text);
  const eatingDisorder = EATING_DISORDER.test(text);
  const anxietyMarkers = ANXIETY.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0);
  return {
    drugMentions,
    selfHarm,
    eatingDisorder,
    anxietyMarkers,
    highRisk: drugMentions.length > 0 || selfHarm || eatingDisorder,
  };
}

export type OutputViolationKind = "shaming_tone" | "false_certainty" | "privacy_leak";

export interface OutputViolation {
  kind: OutputViolationKind;
  blocking: boolean;
  detail: string;
}

export interface OutputFilterResult {
  ok: boolean;
  violations: OutputViolation[];
  /** Possibly-softened text (certainty hedges added). */
  text: string;
}

const SHAMING = [
  /\byou should be ashamed\b/i, /\byou'?re (just )?(lazy|weak)\b/i, /\bjust try harder\b/i,
  /\bit'?s your(own)? fault\b/i, /\bstop being\b/i,
];
const CERTAINTY = [
  /\bguaranteed\b/i, /\b100%\s*(safe|effective)\b/i, /\bwill (definitely|certainly) cure\b/i,
  /\bcompletely safe\b/i, /\bno risk\b/i, /\balways works\b/i, /\bnever fails\b/i, /\bthis will cure\b/i,
];
const PII = [
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN-like
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, // email
  /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/, // phone
];

export function filterOutput(input: string): OutputFilterResult {
  const violations: OutputViolation[] = [];
  let text = input;

  for (const re of SHAMING) {
    if (re.test(text)) {
      violations.push({ kind: "shaming_tone", blocking: true, detail: `matched ${re}` });
      break;
    }
  }
  for (const re of PII) {
    if (re.test(text)) {
      violations.push({ kind: "privacy_leak", blocking: true, detail: `matched ${re}` });
      break;
    }
  }
  let softened = false;
  for (const re of CERTAINTY) {
    if (re.test(text)) softened = true;
  }
  if (softened) {
    violations.push({ kind: "false_certainty", blocking: false, detail: "overconfident phrasing softened" });
    text =
      text +
      "\n\n(Note: I've phrased this cautiously — nothing here is guaranteed, and individual situations vary.)";
  }

  const ok = violations.every((v) => !v.blocking);
  return { ok, violations, text };
}
