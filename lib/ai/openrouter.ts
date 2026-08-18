import {
  ProviderError,
  type EmbeddingProvider,
  type LLMInput,
  type LLMProvider,
  type LLMResponse,
} from "@/lib/ai/provider";
import { EmbeddingResponseSchema } from "@/lib/ai/schemas";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";
const REQUEST_TIMEOUT_MS = 20_000;

/** Shared POST helper — both OpenRouter endpoints need the same timeout/error mapping. */
async function postToOpenRouter(url: string, apiKey: string, body: unknown): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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
    const responseBody = await res.text().catch(() => "");
    throw new ProviderError(`OpenRouter returned HTTP ${res.status}`, "http", responseBody);
  }

  return res.json().catch((error) => {
    throw new ProviderError("OpenRouter returned invalid JSON", "invalid_response", error);
  });
}

export class OpenRouterProvider implements LLMProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async generateResponse(input: LLMInput): Promise<LLMResponse> {
    const data = (await postToOpenRouter(OPENROUTER_CHAT_URL, this.apiKey, {
      model: this.model,
      messages: input.messages,
      temperature: input.temperature ?? 0.3,
      ...(input.jsonMode ? { response_format: { type: "json_object" } } : {}),
    })) as { choices?: Array<{ message?: { content?: unknown } }> };

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new ProviderError("OpenRouter response missing message content", "invalid_response", data);
    }

    return { content };
  }
}

export class OpenRouterEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async embed(text: string): Promise<number[]> {
    const data = await postToOpenRouter(OPENROUTER_EMBEDDINGS_URL, this.apiKey, {
      model: this.model,
      input: text,
    });

    const parsed = EmbeddingResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new ProviderError("OpenRouter embeddings response had an unexpected shape", "invalid_response", data);
    }

    return parsed.data.data[0].embedding;
  }
}
