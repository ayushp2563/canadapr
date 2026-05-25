import { Request, Response, NextFunction } from "express";
import { z } from "zod";

// ============================================================
// Input Sanitization & Validation
// ============================================================

const JAILBREAK_PATTERNS = [
  /ignore (previous|all|your) (instructions|prompt|system)/i,
  /you are now/i,
  /pretend (you are|to be)/i,
  /forget (everything|all|your training)/i,
  /act as (?!an? (immigration|rcic|lawyer|consultant))/i,
  /disregard (your|all)/i,
  /jailbreak/i,
  /DAN mode/i,
  /system prompt/i,
  /<script[\s\S]*?>/i,
  /SELECT\s+.+\s+FROM/i,
  /DROP\s+TABLE/i,
  /UNION\s+SELECT/i,
];

const IMMIGRATION_KEYWORDS = [
  "canada", "immigration", "visa", "pr", "permanent", "express",
  "entry", "pnp", "provincial", "crs", "score", "draw", "ircc",
  "citizenship", "sponsorship", "work", "study", "refugee", "asylum",
  "lmia", "noc", "teer", "ielts", "celpip", "wes", "eca",
  "pathway", "atlantic", "rural", "startup", "caregiver", "family",
  "french", "biometric", "medical", "police", "background",
  "application", "processing", "portal", "cic", "irpa", "rcic",
  "hello", "hi", "help", "what", "how", "when", "where", "which",
  "can", "could", "would", "should", "is", "are", "do", "does",
  "latest", "recent", "current", "new", "update", "information",
  "please", "thank", "bonjour", "merci", "aide", "québec", "ontario",
];

export const chatRequestSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(2000, "Message too long (max 2000 characters)"),
  sessionId: z.string().uuid("sessionId must be a valid UUID").optional(),
  language: z.enum(["en", "fr"]).default("en"),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      })
    )
    .max(20)
    .optional()
    .default([]),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export function sanitizeChatRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const parsed = chatRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { message } = parsed.data;

  // Check for jailbreak attempts
  for (const pattern of JAILBREAK_PATTERNS) {
    if (pattern.test(message)) {
      res.status(400).json({
        error:
          "I can only answer questions about Canadian immigration. Please ask me about Express Entry, PNP programs, family sponsorship, or other Canadian PR pathways.",
        code: "JAILBREAK_DETECTED",
      });
      return;
    }
  }

  // Check topic relevance for longer messages
  const wordCount = message.split(/\s+/).length;
  if (wordCount > 8) {
    const lower = message.toLowerCase();
    const isRelevant = IMMIGRATION_KEYWORDS.some((kw) => lower.includes(kw));
    if (!isRelevant) {
      res.status(400).json({
        error:
          "I'm specialized in Canadian immigration topics. Please ask me about Express Entry, PNP programs, family sponsorship, CRS scores, or any other Canadian PR pathway.",
        code: "OFF_TOPIC",
      });
      return;
    }
  }

  // Attach validated + sanitized data to request
  req.body = parsed.data;
  next();
}
