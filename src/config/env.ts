import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  // LLM APIs
  GROQ_API_KEY: z.string().min(1, "GROQ_API_KEY is required"),
  MISTRAL_API_KEY: z.string().min(1, "MISTRAL_API_KEY is required"),
  OPENAI_API_KEY: z.string().optional(),

  // Database
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL URL"),

  // Vector Store
  CHROMA_URL: z.string().url().default("http://localhost:8000"),
  CHROMA_COLLECTION: z.string().default("ircc_documents"),

  // Server
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Scraper
  SCRAPER_INTERVAL_HOURS: z.coerce.number().default(6),

  // Security
  WEBHOOK_API_KEY: z.string().default("change-me-in-production"),

  // Optional integrations
  ALERT_WEBHOOK_URL: z
    .string()
    .url()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
});

export type Env = z.infer<typeof envSchema>;

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error("❌ Invalid environment variables:");
  for (const err of parseResult.error.errors) {
    console.error(`  ${err.path.join(".")}: ${err.message}`);
  }
  console.error("\nCopy .env.example to .env and fill in the values.");
  process.exit(1);
}

export const env: Env = parseResult.data;
