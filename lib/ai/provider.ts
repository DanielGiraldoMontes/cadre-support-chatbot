export type LLMRole = "system" | "user" | "assistant";

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface LLMInput {
  messages: LLMMessage[];
  /** Ask the provider to return strict JSON (used for intent classification). */
  jsonMode?: boolean;
  temperature?: number;
}

export interface LLMResponse {
  content: string;
}

export interface LLMProvider {
  generateResponse(input: LLMInput): Promise<LLMResponse>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly kind: "timeout" | "http" | "invalid_response" | "network",
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
