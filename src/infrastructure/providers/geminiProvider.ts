import {
  type AIProvider,
  type CompletionRequest,
  type CompletionResponse,
  type HttpPostJson,
  defaultHttpPostJson,
  ProviderError,
} from "./provider.ts";

export interface GeminiConfig {
  apiKey: string;
  model?: string;
  http?: HttpPostJson;
  baseUrl?: string;
}

/**
 * Google Gemini adapter (the app's stated primary model). Request/response
 * shape per generativelanguage v1beta generateContent. The API key is read
 * from injected config (sourced from a secret manager at deploy — never .env.local;
 * report T4 "key rotation via secret management").
 */
export class GeminiProvider implements AIProvider {
  readonly name = "gemini" as const;
  readonly model: string;
  private readonly apiKey: string;
  private readonly http: HttpPostJson;
  private readonly baseUrl: string;

  constructor(cfg: GeminiConfig) {
    if (!cfg.apiKey) throw new ProviderError("gemini", "missing apiKey");
    this.apiKey = cfg.apiKey;
    this.model = cfg.model ?? "gemini-1.5-pro";
    this.http = cfg.http ?? defaultHttpPostJson;
    this.baseUrl = cfg.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
  }

  buildBody(req: CompletionRequest): unknown {
    const userText = req.context ? `${req.context}\n\n---\n\n${req.user}` : req.user;
    return {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: {
        maxOutputTokens: req.maxTokens ?? 1024,
        temperature: req.temperature ?? 0.4,
      },
    };
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
    const { status, json } = await this.http(url, {}, this.buildBody(req));
    if (status < 200 || status >= 300) {
      throw new ProviderError("gemini", `HTTP ${status}`, status);
    }
    const text = extractGeminiText(json);
    if (text === undefined) throw new ProviderError("gemini", "no text in response");
    return { text, provider: "gemini", model: this.model, finishReason: "stop" };
  }
}

function extractGeminiText(json: unknown): string | undefined {
  const candidates = (json as { candidates?: unknown })?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return undefined;
  const parts = (candidates[0] as { content?: { parts?: unknown } })?.content?.parts;
  if (!Array.isArray(parts)) return undefined;
  const texts = parts
    .map((p) => (p as { text?: unknown }).text)
    .filter((t): t is string => typeof t === "string");
  return texts.length ? texts.join("") : undefined;
}
