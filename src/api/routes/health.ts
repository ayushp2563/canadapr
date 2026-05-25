import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { checkGroqHealth } from "../../llm/groqClient.js";
import { checkMistralHealth } from "../../llm/mistralClient.js";
import { checkChromaHealth } from "../../rag/vectorStore.js";

const router = Router();
const prisma = new PrismaClient();

// ============================================================
// GET /api/health
// ============================================================
router.get("/", async (_req: Request, res: Response) => {
  const [groqOk, mistralOk, chromaOk] = await Promise.allSettled([
    checkGroqHealth(),
    checkMistralHealth(),
    checkChromaHealth(),
  ]);

  // Get latest scraper run
  let lastScrape: Date | null = null;
  let dbOk = false;
  try {
    const run = await prisma.scraperRun.findFirst({
      where: { status: "success" },
      orderBy: { runAt: "desc" },
    });
    lastScrape = run?.runAt ?? null;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  // Get draw counts
  let totalDraws = 0;
  let totalAnnouncements = 0;
  try {
    [totalDraws, totalAnnouncements] = await Promise.all([
      prisma.expressEntryDraw.count(),
      prisma.irccAnnouncement.count(),
    ]);
  } catch {
    // Non-critical
  }

  const health = {
    status:
      groqOk.status === "fulfilled" && groqOk.value && dbOk
        ? "healthy"
        : "degraded",
    timestamp: new Date().toISOString(),
    services: {
      groq: groqOk.status === "fulfilled" ? groqOk.value : false,
      mistral: mistralOk.status === "fulfilled" ? mistralOk.value : false,
      vectorDb: chromaOk.status === "fulfilled" ? chromaOk.value : false,
      database: dbOk,
    },
    data: {
      totalDraws,
      totalAnnouncements,
      lastScrape,
    },
    version: "1.0.0",
  };

  const httpStatus = health.status === "healthy" ? 200 : 207;
  res.status(httpStatus).json(health);
});

export default router;
