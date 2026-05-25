import { Mistral } from "@mistralai/mistralai";
import { env } from "../config/env.js";
import { MODELS, GENERATION_PARAMS } from "../config/models.js";

// ============================================================
// Mistral Client Singleton
// ============================================================
let mistralInstance: Mistral | null = null;

export function getMistralClient(): Mistral {
  if (!mistralInstance) {
    mistralInstance = new Mistral({ apiKey: env.MISTRAL_API_KEY });
  }
  return mistralInstance;
}

// ============================================================
// Types
// ============================================================
export interface MistralMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface MistralCompletionOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface MistralCompletionResult {
  content: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ============================================================
// Completion (Non-Streaming)
// ============================================================
export async function mistralComplete(
  messages: MistralMessage[],
  options: MistralCompletionOptions = {}
): Promise<MistralCompletionResult> {
  const client = getMistralClient();
  const model = options.model ?? MODELS.mistral.fallback;
  const params =
    model === MODELS.mistral.analysis
      ? GENERATION_PARAMS.mistral.analysis
      : GENERATION_PARAMS.mistral.fallback;

  const response = await client.chat.complete({
    model,
    messages,
    temperature: options.temperature ?? params.temperature,
    maxTokens: options.max_tokens ?? params.max_tokens,
  });

  const choice = response.choices?.[0];
  const content =
    typeof choice?.message?.content === "string"
      ? choice.message.content
      : "";

  if (!content) {
    throw new Error("Empty response from Mistral");
  }

  return {
    content,
    model: response.model ?? model,
    usage: {
      prompt_tokens: response.usage?.promptTokens ?? 0,
      completion_tokens: response.usage?.completionTokens ?? 0,
      total_tokens: response.usage?.totalTokens ?? 0,
    },
  };
}

// ============================================================
// Streaming Completion (SSE)
// ============================================================
export async function* mistralCompleteStream(
  messages: MistralMessage[],
  options: MistralCompletionOptions = {}
): AsyncGenerator<string, void, unknown> {
  const client = getMistralClient();
  const model = options.model ?? MODELS.mistral.fallback;

  const stream = await client.chat.stream({
    model,
    messages,
    temperature: options.temperature ?? GENERATION_PARAMS.mistral.fallback.temperature,
    maxTokens: options.max_tokens ?? GENERATION_PARAMS.mistral.fallback.max_tokens,
  });

  for await (const chunk of stream) {
    const delta = chunk.data?.choices?.[0]?.delta?.content;
    if (delta && typeof delta === "string") {
      yield delta;
    }
  }
}

// ============================================================
// Health Check
// ============================================================
export async function checkMistralHealth(): Promise<boolean> {
  try {
    const result = await mistralComplete(
      [{ role: "user", content: "Reply with only: ok" }],
      { model: MODELS.mistral.fallback, max_tokens: 5 }
    );
    return result.content.toLowerCase().includes("ok");
  } catch {
    return false;
  }
}
