// ============================================================
// Model Configuration for Canada PR Immigration Assistant
// ============================================================

export const MODELS = {
  groq: {
    /** Best for complex immigration Q&A, multi-step eligibility analysis */
    primary: "llama-3.3-70b-versatile",
    /** Fast lookups, draw summaries, simple factual questions */
    fast: "llama-3.1-8b-instant",
    // Note: Groq does NOT offer embedding models
  },
  mistral: {
    /** Fallback when Groq is rate-limited (429) or unavailable (503) */
    fallback: "mistral-large-latest",
    /** Deep policy analysis, complex document review */
    analysis: "mistral-medium-latest",
    /** Embeddings — 1024-dim, multilingual */
    embeddings: "mistral-embed",
  },
} as const;

// ============================================================
// Query Complexity Classification
// Used by router.ts to select the right model
// ============================================================
export type QueryComplexity = "simple" | "complex" | "analysis";

export const COMPLEXITY_THRESHOLDS = {
  /** Token count below this → use groq.fast */
  simpleMaxTokens: 100,
  /** Keywords that trigger complex routing */
  complexKeywords: [
    "eligib",
    "qualify",
    "calculate",
    "crs score",
    "points",
    "provincial nominee",
    "pnp",
    "sponsorship",
    "sponsoring",
    "startup visa",
    "caregiver",
    "atlantic immigration",
    "rural",
    "northern",
    "arrange employment",
    "lmia",
    "job offer",
    "language test",
    "ielts",
    "celpip",
    "education credential",
    "wes",
    "eca",
    "work experience",
    "occupation",
    "noc",
    "teer",
  ],
  /** Keywords that trigger analysis routing */
  analysisKeywords: [
    "policy change",
    "new regulation",
    "amendment",
    "bill",
    "budget",
    "ministerial instruction",
    "legal opinion",
    "compare pathways",
    "best strategy",
  ],
} as const;

// ============================================================
// LLM Generation Parameters
// ============================================================
export const GENERATION_PARAMS = {
  groq: {
    primary: {
      temperature: 0.3,
      max_tokens: 2048,
      top_p: 0.9,
    },
    fast: {
      temperature: 0.2,
      max_tokens: 1024,
      top_p: 0.9,
    },
  },
  mistral: {
    fallback: {
      temperature: 0.3,
      max_tokens: 2048,
      top_p: 0.9,
    },
    analysis: {
      temperature: 0.2,
      max_tokens: 4096,
      top_p: 0.9,
    },
  },
} as const;

// ============================================================
// Retry Configuration
// ============================================================
export const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  /** HTTP status codes that trigger retry (not fallback) */
  retryStatusCodes: [429, 503, 502, 504],
} as const;

// ============================================================
// RAG Configuration
// ============================================================
export const RAG_CONFIG = {
  chunkSize: 1000,
  chunkOverlap: 200,
  topK: 5,
  /** Minimum similarity score to include a chunk */
  minRelevanceScore: 0.7,
} as const;
