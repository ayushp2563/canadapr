import Groq from "groq-sdk";
import { env } from "../config/env.js";
import { MODELS, GENERATION_PARAMS, RETRY_CONFIG } from "../config/models.js";

// ============================================================
// Groq Client Singleton
// ============================================================
let groqInstance: Groq | null = null;

export function getGroqClient(): Groq {
  if (!groqInstance) {
    groqInstance = new Groq({ apiKey: env.GROQ_API_KEY });
  }
  return groqInstance;
}

// ============================================================
// Types
// ============================================================
export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqCompletionOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface GroqCompletionResult {
  content: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ============================================================
// Exponential Backoff Helper
// ============================================================
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = RETRY_CONFIG.maxRetries,
  delay: number = RETRY_CONFIG.initialDelayMs
): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const statusCode = (err as { status?: number })?.status;
    const isRetryable =
      retries > 0 &&
      statusCode !== undefined &&
      RETRY_CONFIG.retryStatusCodes.includes(statusCode as typeof RETRY_CONFIG.retryStatusCodes[number]);

    if (!isRetryable) throw err;

    const jitter = Math.random() * 500;
    const nextDelay = Math.min(delay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs) + jitter;
    console.warn(
      `Groq rate limit/error (${statusCode}). Retrying in ${Math.round(nextDelay)}ms... (${retries} retries left)`
    );
    await sleep(nextDelay);
    return withRetry(fn, retries - 1, nextDelay);
  }
}

// ============================================================
// Completion (Non-Streaming)
// ============================================================
export async function groqComplete(
  messages: GroqMessage[],
  options: GroqCompletionOptions = {}
): Promise<GroqCompletionResult> {
  const client = getGroqClient();
  const model = options.model ?? MODELS.groq.primary;
  const params =
    model === MODELS.groq.fast ? GENERATION_PARAMS.groq.fast : GENERATION_PARAMS.groq.primary;

  return withRetry(async () => {
    const response = await client.chat.completions.create({
      model,
      messages,
      temperature: options.temperature ?? params.temperature,
      max_tokens: options.max_tokens ?? params.max_tokens,
      top_p: params.top_p,
      stream: false,
    });

    const choice = response.choices[0];
    if (!choice?.message?.content) {
      throw new Error("Empty response from Groq");
    }

    return {
      content: choice.message.content,
      model: response.model,
      usage: {
        prompt_tokens: response.usage?.prompt_tokens ?? 0,
        completion_tokens: response.usage?.completion_tokens ?? 0,
        total_tokens: response.usage?.total_tokens ?? 0,
      },
    };
  });
}

// ============================================================
// Streaming Completion (SSE)
// Returns an async generator that yields text chunks
// ============================================================
export async function* groqCompleteStream(
  messages: GroqMessage[],
  options: GroqCompletionOptions = {}
): AsyncGenerator<string, void, unknown> {
  const client = getGroqClient();
  const model = options.model ?? MODELS.groq.primary;

  const stream = await client.chat.completions.create({
    model,
    messages,
    temperature: options.temperature ?? GENERATION_PARAMS.groq.primary.temperature,
    max_tokens: options.max_tokens ?? GENERATION_PARAMS.groq.primary.max_tokens,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      yield delta;
    }
  }
}

// ============================================================
// Health Check
// ============================================================
export async function checkGroqHealth(): Promise<boolean> {
  try {
    const result = await groqComplete(
      [{ role: "user", content: "Reply with only: ok" }],
      { model: MODELS.groq.fast, max_tokens: 5 }
    );
    return result.content.toLowerCase().includes("ok");
  } catch {
    return false;
  }
}
