import { ProviderError, type LLMInput, type LLMProvider, type LLMResponse } from "@/lib/ai/provider";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 20_000;

export class OpenRouterProvider implements LLMProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async generateResponse(input: LLMInput): Promise<LLMResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(OPENROUTER_CHAT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: input.messages,
          temperature: input.temperature ?? 0.3,
          ...(input.jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ProviderError("OpenRouter request timed out", "timeout", error);
      }
      throw new ProviderError("OpenRouter request failed", "network", error);
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ProviderError(`OpenRouter returned HTTP ${res.status}`, "http", body);
    }

    const data = await res.json().catch((error) => {
      throw new ProviderError("OpenRouter returned invalid JSON", "invalid_response", error);
    });

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new ProviderError("OpenRouter response missing message content", "invalid_response", data);
    }

    return { content };
  }
}
