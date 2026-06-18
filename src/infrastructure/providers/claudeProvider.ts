import {
  type AIProvider,
  type CompletionRequest,
  type CompletionResponse,
  type HttpPostJson,
  defaultHttpPostJson,
  ProviderError,
} from "./provider.ts";

export interface ClaudeConfig {
  apiKey: string;
  model?: string;
  http?: HttpPostJson;
  baseUrl?: string;
  anthropicVersion?: string;
}

/** Anthropic Claude adapter — used as a fallback and as the high-stakes checker. */
export class ClaudeProvider implements AIProvider {
  readonly name = "claude" as const;
  readonly model: string;
  private readonly apiKey: string;
  private readonly http: HttpPostJson;
  private readonly baseUrl: string;
  private readonly version: string;

  constructor(cfg: ClaudeConfig) {
    if (!cfg.apiKey) throw new ProviderError("claude", "missing apiKey");
    this.apiKey = cfg.apiKey;
    this.model = cfg.model ?? "claude-3-5-sonnet-latest";
    this.http = cfg.http ?? defaultHttpPostJson;
    this.baseUrl = cfg.baseUrl ?? "https://api.anthropic.com";
    this.version = cfg.anthropicVersion ?? "2023-06-01";
  }

  buildBody(req: CompletionRequest): unknown {
    const userText = req.context ? `${req.context}\n\n---\n\n${req.user}` : req.user;
    return {
      model: this.model,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.4,
      system: req.system,
      messages: [{ role: "user", content: userText }],
    };
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const url = `${this.baseUrl}/v1/messages`;
    const headers = {
      "x-api-key": this.apiKey,
      "anthropic-version": this.version,
    };
    const { status, json } = await this.http(url, headers, this.buildBody(req));
    if (status < 200 || status >= 300) {
      throw new ProviderError("claude", `HTTP ${status}`, status);
    }
    const text = extractClaudeText(json);
    if (text === undefined) throw new ProviderError("claude", "no text in response");
    return { text, provider: "claude", model: this.model, finishReason: "stop" };
  }
}

function extractClaudeText(json: unknown): string | undefined {
  const content = (json as { content?: unknown })?.content;
  if (!Array.isArray(content)) return undefined;
  const texts = content
    .filter((b) => (b as { type?: string }).type === "text")
    .map((b) => (b as { text?: unknown }).text)
    .filter((t): t is string => typeof t === "string");
  return texts.length ? texts.join("") : undefined;
}
