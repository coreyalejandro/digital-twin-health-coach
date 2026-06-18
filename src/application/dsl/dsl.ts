import { type QueryTier, TIER_ORDER } from "../../domain/query.ts";
import { type ConfidenceTier } from "../../domain/confidence.ts";
import { type Result, ok, err } from "../../domain/result.ts";

/**
 * Digital Twin Specification Language (report H7 / §8.2). A tiny, auditable DSL
 * that lets clinicians and UX researchers define coaching behaviour, citations
 * and safety boundaries WITHOUT engineering — compiled into executable matching
 * logic. Grammar (one rule per line; '#' begins a comment):
 *
 *   WHEN <conditions> THEN <actions>
 *
 *   conditions (joined by AND or commas):
 *     tier = wellness|health_information|medical_advice|emergency
 *     topic ~ "substring"
 *     distress
 *     risk
 *
 *   actions (space separated):
 *     block
 *     escalate = clinician|crisis|human_help|distress
 *     cite = kb:some-id           (repeatable)
 *     confidence = verified|evidence_backed|heuristic|uncertain|refused
 *     say = "free text"
 */

export interface RuleContext {
  tier: QueryTier;
  topic: string;
  distress: boolean;
  risk: boolean;
}

export interface RuleAction {
  block: boolean;
  escalate?: string;
  cite: string[];
  confidence?: ConfidenceTier;
  say?: string;
}

interface Condition {
  test(ctx: RuleContext): boolean;
}

interface Rule {
  source: string;
  conditions: Condition[];
  action: RuleAction;
}

export interface CompiledRuleset {
  ruleCount: number;
  evaluate(ctx: RuleContext): RuleAction | undefined;
}

export interface ParseError {
  line: number;
  message: string;
}

const TIERS = new Set<string>(TIER_ORDER);
const TIER_VALUES = TIER_ORDER as readonly string[];
const CONF = new Set<string>(["verified", "evidence_backed", "heuristic", "uncertain", "refused"]);
const ESCALATE = new Set<string>(["clinician", "crisis", "human_help", "distress"]);

export function parseRuleset(source: string): Result<CompiledRuleset, ParseError> {
  const rules: Rule[] = [];
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]!.replace(/#.*$/, "").trim();
    if (raw === "") continue;
    const m = /^when\s+(.+?)\s+then\s+(.+)$/i.exec(raw);
    if (!m) return err({ line: i + 1, message: "expected 'WHEN <conditions> THEN <actions>'" });

    const condParse = parseConditions(m[1]!, i + 1);
    if (!condParse.ok) return condParse;
    const actParse = parseActions(m[2]!, i + 1);
    if (!actParse.ok) return actParse;

    rules.push({ source: raw, conditions: condParse.value, action: actParse.value });
  }

  return ok({
    ruleCount: rules.length,
    evaluate(ctx: RuleContext): RuleAction | undefined {
      for (const r of rules) {
        if (r.conditions.every((c) => c.test(ctx))) return r.action;
      }
      return undefined;
    },
  });
}

function parseConditions(text: string, line: number): Result<Condition[], ParseError> {
  const parts = text.split(/\s+and\s+|,/i).map((p) => p.trim()).filter(Boolean);
  const out: Condition[] = [];
  for (const part of parts) {
    let mm: RegExpExecArray | null;
    if ((mm = /^tier\s*=\s*([a-z_]+)$/i.exec(part))) {
      const v = mm[1]!.toLowerCase();
      if (!TIERS.has(v)) return err({ line, message: `unknown tier '${v}'` });
      out.push({ test: (ctx) => ctx.tier === v });
    } else if ((mm = /^topic\s*~\s*"([^"]*)"$/i.exec(part))) {
      const needle = mm[1]!.toLowerCase();
      out.push({ test: (ctx) => ctx.topic.toLowerCase().includes(needle) });
    } else if (/^distress$/i.test(part)) {
      out.push({ test: (ctx) => ctx.distress });
    } else if (/^risk$/i.test(part)) {
      out.push({ test: (ctx) => ctx.risk });
    } else {
      return err({ line, message: `unparseable condition '${part}'` });
    }
  }
  if (out.length === 0) return err({ line, message: "no conditions" });
  return ok(out);
}

function parseActions(text: string, line: number): Result<RuleAction, ParseError> {
  const action: RuleAction = { block: false, cite: [] };

  // Extract say="..." first (may contain spaces), then tokenize the remainder.
  let rest = text;
  const sayMatch = /say\s*=\s*"([^"]*)"/i.exec(rest);
  if (sayMatch) {
    action.say = sayMatch[1]!;
    rest = rest.slice(0, sayMatch.index) + rest.slice(sayMatch.index + sayMatch[0].length);
  }

  // Normalise spaces around '=' so "escalate = crisis" tokenises as one token.
  rest = rest.replace(/\s*=\s*/g, "=");
  const tokens = rest.split(/\s+/).map((t) => t.trim()).filter(Boolean);
  for (const tok of tokens) {
    let mm: RegExpExecArray | null;
    if (/^block$/i.test(tok)) {
      action.block = true;
    } else if ((mm = /^escalate\s*=\s*([a-z_]+)$/i.exec(tok))) {
      const v = mm[1]!.toLowerCase();
      if (!ESCALATE.has(v)) return err({ line, message: `unknown escalate target '${v}'` });
      action.escalate = v;
    } else if ((mm = /^cite\s*=\s*([a-z]+:[a-z0-9-]+)$/i.exec(tok))) {
      action.cite.push(mm[1]!);
    } else if ((mm = /^confidence\s*=\s*([a-z_]+)$/i.exec(tok))) {
      const v = mm[1]!.toLowerCase();
      if (!CONF.has(v)) return err({ line, message: `unknown confidence '${v}'` });
      action.confidence = v as ConfidenceTier;
    } else {
      return err({ line, message: `unparseable action '${tok}'` });
    }
  }
  return ok(action);
}

export { TIER_VALUES };
