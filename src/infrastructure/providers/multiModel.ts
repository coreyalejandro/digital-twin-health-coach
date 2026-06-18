import type {
  AIProvider,
  CompletionRequest,
  CompletionResponse,
} from "./provider.ts";

/**
 * Multi-model router (report T4 + Architect §3 HVA "safety mesh"):
 *  - Resilience: if the primary provider errors, fall through to the next.
 *  - Safety-consistency: for high-stakes queries, a second model independently
 *    answers and we compare. Disagreement is a signal to escalate to a human
 *    rather than gamble on one model's output.
 */

export interface RoutedCompletion {
  primary: CompletionResponse;
  checker?: CompletionResponse;
  usedFallback: boolean;
  agreement?: AgreementReport;
}

export interface AgreementReport {
  similarity: number;
  contradiction: boolean;
  agreed: boolean;
}

const SIMILARITY_THRESHOLD = 0.35;

const NEGATION = ["do not", "don't", "avoid", "should not", "shouldn't", "never", "stop taking", "not safe"];
const AFFIRMATION = ["you should", "you can", "go ahead", "it's safe", "it is safe", "increase", "double the", "take more"];

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

export function jaccard(a: string, b: string): number {
  const sa = tokens(a);
  const sb = tokens(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function stance(text: string): number {
  const t = text.toLowerCase();
  let score = 0;
  for (const m of AFFIRMATION) if (t.includes(m)) score += 1;
  for (const m of NEGATION) if (t.includes(m)) score -= 1;
  return score;
}

export function assessAgreement(a: string, b: string): AgreementReport {
  const similarity = jaccard(a, b);
  const sa = stance(a);
  const sb = stance(b);
  // Opposing stance (one endorses an action, the other warns against it).
  const contradiction = sa * sb < 0 && Math.abs(sa) + Math.abs(sb) >= 2;
  const agreed = similarity >= SIMILARITY_THRESHOLD && !contradiction;
  return { similarity: Number(similarity.toFixed(3)), contradiction, agreed };
}

export class MultiModelRouter {
  private readonly providers: AIProvider[];
  private readonly checker?: AIProvider;

  /**
   * @param providers ordered list; providers[0] is primary, the rest fallbacks.
   * @param checker optional independent model used for high-stakes cross-checks.
   */
  constructor(providers: AIProvider[], checker?: AIProvider) {
    if (providers.length === 0) throw new Error("at least one provider required");
    this.providers = providers;
    this.checker = checker;
  }

  private async tryPrimaryChain(req: CompletionRequest): Promise<{ res: CompletionResponse; usedFallback: boolean }> {
    let lastErr: unknown;
    for (let i = 0; i < this.providers.length; i += 1) {
      try {
        const res = await this.providers[i]!.complete(req);
        return { res, usedFallback: i > 0 };
      } catch (e) {
        lastErr = e;
      }
    }
    throw new Error(`all providers failed: ${String(lastErr)}`);
  }

  async route(
    req: CompletionRequest,
    opts: { highStakes?: boolean } = {},
  ): Promise<RoutedCompletion> {
    const { res: primary, usedFallback } = await this.tryPrimaryChain(req);
    if (!opts.highStakes || !this.checker) {
      return { primary, usedFallback };
    }
    let checker: CompletionResponse | undefined;
    try {
      checker = await this.checker.complete(req);
    } catch {
      // Checker outage on a high-stakes query: treat as NON-agreement (fail closed).
      return {
        primary,
        usedFallback,
        agreement: { similarity: 0, contradiction: false, agreed: false },
      };
    }
    const agreement = assessAgreement(primary.text, checker.text);
    return { primary, checker, usedFallback, agreement };
  }
}

/** True when a high-stakes routed completion should trigger human escalation. */
export function disagreementDetected(routed: RoutedCompletion): boolean {
  return routed.agreement !== undefined && routed.agreement.agreed === false;
}
