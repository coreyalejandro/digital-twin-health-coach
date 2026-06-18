import {
  type AIProvider,
  type CompletionRequest,
  type CompletionResponse,
  type HttpPostJson,
  defaultHttpPostJson,
  ProviderError,
} from "./provider.ts";

export interface OpenAIConfig {
  apiKey: string;
  model?: string;
  http?: HttpPostJson;
  baseUrl?: string;
}

/** OpenAI Chat Completions adapter — second fallback in the model chain. */
export class OpenAIProvider implements AIProvider {
  readonly name = "openai" as const;
  readonly model: string;
  private readonly apiKey: string;
  private readonly http: HttpPostJson;
  private readonly baseUrl: string;

  constructor(cfg: OpenAIConfig) {
    if (!cfg.apiKey) throw new ProviderError("openai", "missing apiKey");
    this.apiKey = cfg.apiKey;
    this.model = cfg.model ?? "gpt-4o";
    this.http = cfg.http ?? defaultHttpPostJson;
    this.baseUrl = cfg.baseUrl ?? "https://api.openai.com";
  }

  buildBody(req: CompletionRequest): unknown {
    const userText = req.context ? `${req.context}\n\n---\n\n${req.user}` : req.user;
    return {
      model: this.model,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.4,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: userText },
      ],
    };
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const url = `${this.baseUrl}/v1/chat/completions`;
    const headers = { authorization: `Bearer ${this.apiKey}` };
    const { status, json } = await this.http(url, headers, this.buildBody(req));
    if (status < 200 || status >= 300) {
      throw new ProviderError("openai", `HTTP ${status}`, status);
    }
    const text = extractOpenAIText(json);
    if (text === undefined) throw new ProviderError("openai", "no text in response");
    return { text, provider: "openai", model: this.model, finishReason: "stop" };
  }
}

function extractOpenAIText(json: unknown): string | undefined {
  const choices = (json as { choices?: unknown })?.choices;
  if (!Array.isArray(choices) || choices.length === 0) return undefined;
  const content = (choices[0] as { message?: { content?: unknown } })?.message?.content;
  return typeof content === "string" ? content : undefined;
}
