/**
 * Pluggable multi-model AI provider interface (report §1.1, T4, Architect §3
 * "High Value Added": a safety mesh of models). Application code depends on
 * AIProvider, never on a specific vendor SDK, so Gemini/Claude/OpenAI are
 * interchangeable and a deterministic mock can stand in for tests/local runs.
 */

export type ProviderName = "gemini" | "claude" | "openai" | "mock";

export interface CompletionRequest {
  system: string;
  user: string;
  /** Retrieved knowledge-base context injected by the coaching service (I1). */
  context?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface CompletionResponse {
  text: string;
  provider: ProviderName;
  model: string;
  /** 0..1 self-reported/estimated confidence, when available. */
  selfReportedConfidence?: number;
  finishReason?: string;
}

export interface AIProvider {
  readonly name: ProviderName;
  readonly model: string;
  complete(req: CompletionRequest): Promise<CompletionResponse>;
}

/**
 * Injected HTTP transport so vendor adapters are testable and do not hardwire
 * `fetch` (which, notably, ignores HTTPS_PROXY under Node — see README). A
 * curl-backed transport can be supplied in environments where fetch is blocked.
 */
export type HttpPostJson = (
  url: string,
  headers: Record<string, string>,
  body: unknown,
) => Promise<{ status: number; json: unknown; text: string }>;

export const defaultHttpPostJson: HttpPostJson = async (url, headers, body) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = undefined;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: res.status, json, text };
};

export class ProviderError extends Error {
  readonly provider: ProviderName;
  readonly status?: number;
  constructor(provider: ProviderName, message: string, status?: number) {
    super(`[${provider}] ${message}`);
    this.name = "ProviderError";
    this.provider = provider;
    this.status = status;
  }
}
