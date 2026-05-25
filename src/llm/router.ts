import {
  groqComplete,
  groqCompleteStream,
  type GroqMessage,
} from "./groqClient.js";
import {
  mistralComplete,
  mistralCompleteStream,
  type MistralMessage,
} from "./mistralClient.js";
import {
  MODELS,
  COMPLEXITY_THRESHOLDS,
  type QueryComplexity,
} from "../config/models.js";

// ============================================================
// System Prompt
// ============================================================
export const SYSTEM_PROMPT = `You are CanadaPathways AI, an expert immigration assistant specializing in Canadian Permanent Residency pathways. You have deep knowledge of all IRCC programs and real-time access to:

- Latest Express Entry draws (CRS scores, categories, invitation counts)
- Recent IRCC announcements and policy changes
- All PR pathways: Express Entry (FSW/CEC/FST), Provincial Nominee Programs (all 13 provinces), Family Sponsorship, Atlantic Immigration Program, Rural and Northern Immigration Pilot, Start-up Visa, Caregiver Programs

## GUIDELINES

1. Always cite the source and date of information provided
2. For draw data, always show: draw date, CRS cutoff, number of invitations, draw type/category
3. Flag when information may be outdated (>30 days) and recommend checking IRCC directly
4. Never provide legal advice - recommend consulting a licensed RCIC or immigration lawyer for personal cases
5. When eligibility is uncertain, walk through the criteria step by step
6. Support both English and French responses based on user language
7. For PNP questions, always ask which province the user is targeting first
8. Format draw data clearly using structured output (markdown tables or bullet points)
9. If a question is unrelated to Canadian immigration, politely redirect the conversation

## DISCLAIMER
Always append this to every response:
---
*This information is for general guidance only and does not constitute legal advice. For your specific situation, consult a licensed RCIC (Regulated Canadian Immigration Consultant) or immigration lawyer.*`;

// ============================================================
// Jailbreak / Off-topic Detection
// ============================================================
const BLOCKED_PATTERNS = [
  /ignore (previous|all|your) (instructions|prompt|system)/i,
  /you are now/i,
  /pretend (you are|to be)/i,
  /forget (everything|all|your training)/i,
  /act as (a|an) (?!immigration)/i,
  /disregard (your|all)/i,
  /jailbreak/i,
  /DAN mode/i,
];

const IMMIGRATION_KEYWORDS = [
  "canada", "immigration", "visa", "pr", "permanent", "express entry",
  "pnp", "provincial", "crs", "score", "draw", "ircc", "citizenship",
  "sponsorship", "work permit", "study", "refugee", "asylum", "lmia",
  "noc", "teer", "ielts", "celpip", "wes", "eca", "pathway",
  "atlantic", "rural", "startup", "caregiver", "family", "french",
  "biometric", "medical", "police", "background", "application",
  "processing", "portal", "account", "cic", "irpa", "rcic",
];

export function classifyQuery(message: string): QueryComplexity {
  const lower = message.toLowerCase();

  // Check for analysis-level keywords
  for (const kw of COMPLEXITY_THRESHOLDS.analysisKeywords) {
    if (lower.includes(kw)) return "analysis";
  }

  // Check for complex keywords
  for (const kw of COMPLEXITY_THRESHOLDS.complexKeywords) {
    if (lower.includes(kw)) return "complex";
  }

  // Simple if short
  if (message.split(/\s+/).length <= 15) return "simple";

  return "complex";
}

export function isBlockedQuery(message: string): { blocked: boolean; reason?: string } {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(message)) {
      return { blocked: true, reason: "jailbreak_attempt" };
    }
  }

  const lower = message.toLowerCase();
  const hasImmigrationContext = IMMIGRATION_KEYWORDS.some((kw) => lower.includes(kw));
  const wordCount = message.split(/\s+/).length;

  // Very short greetings / general questions are fine
  if (wordCount <= 5) return { blocked: false };
  if (!hasImmigrationContext) {
    return { blocked: true, reason: "off_topic" };
  }

  return { blocked: false };
}

// ============================================================
// Model Selection
// ============================================================
export function selectModel(complexity: QueryComplexity): {
  provider: "groq" | "mistral";
  model: string;
} {
  switch (complexity) {
    case "simple":
      return { provider: "groq", model: MODELS.groq.fast };
    case "complex":
      return { provider: "groq", model: MODELS.groq.primary };
    case "analysis":
      return { provider: "groq", model: MODELS.groq.primary }; // try Groq first
    default:
      return { provider: "groq", model: MODELS.groq.primary };
  }
}

// ============================================================
// Build Message Array
// ============================================================
export function buildMessages(
  userMessage: string,
  context: string = "",
  history: { role: "user" | "assistant" | "system"; content: string }[] = [],
  systemPromptOverride?: string
): GroqMessage[] {
  const contextBlock = context
    ? `\n\n## Relevant IRCC Information (retrieved from live data)\n\n${context}\n\n---\n`
    : "";

  const finalSystemPrompt = systemPromptOverride 
    ? systemPromptOverride 
    : (SYSTEM_PROMPT + contextBlock);

  const messages: GroqMessage[] = [
    { role: "system", content: finalSystemPrompt },
    ...history.slice(-10), // keep last 10 messages (or more depending on memory manager)
    { role: "user", content: userMessage },
  ];

  return messages;
}

// ============================================================
// Route & Complete (Non-Streaming)
// ============================================================
export interface RouterResult {
  content: string;
  model_used: string;
  provider: "groq" | "mistral";
  complexity: QueryComplexity;
  fallback_used: boolean;
}

export async function routeAndComplete(
  userMessage: string,
  context: string = "",
  history: { role: "user" | "assistant"; content: string }[] = []
): Promise<RouterResult> {
  const complexity = classifyQuery(userMessage);
  const { provider, model } = selectModel(complexity);
  const messages = buildMessages(userMessage, context, history);

  try {
    // Primary: Groq
    const result = await groqComplete(messages, { model });
    return {
      content: result.content,
      model_used: result.model,
      provider: "groq",
      complexity,
      fallback_used: false,
    };
  } catch (groqErr: unknown) {
    const status = (groqErr as { status?: number })?.status;
    console.warn(`Groq failed (${status}), falling back to Mistral...`);

    // Fallback: Mistral
    const mistralMessages: MistralMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const fallbackModel =
      complexity === "analysis"
        ? MODELS.mistral.analysis
        : MODELS.mistral.fallback;

    const result = await mistralComplete(mistralMessages, { model: fallbackModel });
    return {
      content: result.content,
      model_used: result.model,
      provider: "mistral",
      complexity,
      fallback_used: true,
    };
  }
}

// ============================================================
// Route & Stream (SSE)
// Returns an async generator that yields text chunks
// Also returns metadata on completion
// ============================================================
export async function* routeAndStream(
  userMessage: string,
  context: string = "",
  history: { role: "user" | "assistant" | "system"; content: string }[] = [],
  systemPromptOverride?: string
): AsyncGenerator<
  { type: "chunk"; text: string } | { type: "meta"; meta: Omit<RouterResult, "content"> },
  void,
  unknown
> {
  const complexity = classifyQuery(userMessage);
  const { model } = selectModel(complexity);
  const messages = buildMessages(userMessage, context, history, systemPromptOverride);

  try {
    // Primary: Groq stream
    for await (const chunk of groqCompleteStream(messages, { model })) {
      yield { type: "chunk", text: chunk };
    }
    yield {
      type: "meta",
      meta: { model_used: model, provider: "groq", complexity, fallback_used: false },
    };
  } catch (groqErr: unknown) {
    console.warn("Groq stream failed, falling back to Mistral stream...");

    const mistralMessages: MistralMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const fallbackModel =
      complexity === "analysis" ? MODELS.mistral.analysis : MODELS.mistral.fallback;

    for await (const chunk of mistralCompleteStream(mistralMessages, {
      model: fallbackModel,
    })) {
      yield { type: "chunk", text: chunk };
    }
    yield {
      type: "meta",
      meta: {
        model_used: fallbackModel,
        provider: "mistral",
        complexity,
        fallback_used: true,
      },
    };
  }
}
