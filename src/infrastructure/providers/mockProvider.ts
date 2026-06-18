import type {
  AIProvider,
  CompletionRequest,
  CompletionResponse,
  ProviderName,
} from "./provider.ts";

export interface MockOptions {
  /** Fixed reply, or a function of the request. */
  reply?: string | ((req: CompletionRequest) => string);
  selfReportedConfidence?: number;
  /** Present as a different vendor (for multi-model consistency tests). */
  presentAs?: ProviderName;
  model?: string;
  /** Throw to simulate an outage (exercises fallback / circuit breaker). */
  fail?: boolean;
  /** Artificial latency in ms (exercises timeouts). */
  latencyMs?: number;
}

/**
 * Deterministic provider. Default behaviour gives a generic, *non-directive*
 * wellness reply — the safety pipeline (classification, boundary, filtering) is
 * what we actually test, so the language model is intentionally inert.
 */
export class MockProvider implements AIProvider {
  readonly name: ProviderName;
  readonly model: string;
  private readonly opts: MockOptions;

  constructor(opts: MockOptions = {}) {
    this.opts = opts;
    this.name = opts.presentAs ?? "mock";
    this.model = opts.model ?? "mock-deterministic-1";
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    if (this.opts.latencyMs && this.opts.latencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.opts.latencyMs));
    }
    if (this.opts.fail) {
      throw new Error(`mock provider ${this.name} simulated failure`);
    }
    const text =
      typeof this.opts.reply === "function"
        ? this.opts.reply(req)
        : (this.opts.reply ??
          "Here are some general, low-risk ideas you might consider for building this habit. " +
            "These are general wellness suggestions, not medical advice.");
    return {
      text,
      provider: this.name,
      model: this.model,
      selfReportedConfidence: this.opts.selfReportedConfidence ?? 0.6,
      finishReason: "stop",
    };
  }
}
