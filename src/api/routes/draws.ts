import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { requireApiKey } from "../middleware/auth.js";
import { checkForNewDraws } from "../../scraper/drawTracker.js";
import { z } from "zod";

const router = Router();
const prisma = new PrismaClient();

// ============================================================
// GET /api/draws/latest
// Returns the latest 10 Express Entry draws
// ============================================================
router.get("/latest", async (_req: Request, res: Response) => {
  try {
    const draws = await prisma.expressEntryDraw.findMany({
      orderBy: { drawDate: "desc" },
      take: 10,
    });
    res.json({ draws, count: draws.length });
  } catch (err) {
    console.error("Error fetching latest draws:", err);
    res.status(500).json({ error: "Failed to fetch draw data." });
  }
});

// ============================================================
// GET /api/draws/history
// Query params: limit (default 50), type (draw type filter)
// ============================================================
const historyQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(500).default(50),
  type: z.string().optional(),
  minCrs: z.coerce.number().optional(),
  maxCrs: z.coerce.number().optional(),
});

router.get("/history", async (req: Request, res: Response) => {
  const parsed = historyQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params", details: parsed.error.flatten() });
    return;
  }

  const { limit, type, minCrs, maxCrs } = parsed.data;

  try {
    const draws = await prisma.expressEntryDraw.findMany({
      where: {
        ...(type ? { drawType: { contains: type, mode: "insensitive" } } : {}),
        ...(minCrs || maxCrs
          ? {
              crsScore: {
                ...(minCrs ? { gte: minCrs } : {}),
                ...(maxCrs ? { lte: maxCrs } : {}),
              },
            }
          : {}),
      },
      orderBy: { drawDate: "desc" },
      take: limit,
    });

    // Compute stats
    const stats =
      draws.length > 0
        ? {
            highestCrs: Math.max(...draws.map((d) => d.crsScore)),
            lowestCrs: Math.min(...draws.map((d) => d.crsScore)),
            averageCrs: Math.round(
              draws.reduce((sum, d) => sum + d.crsScore, 0) / draws.length
            ),
            totalInvitations: draws.reduce((sum, d) => sum + d.invitationsIssued, 0),
          }
        : null;

    res.json({ draws, count: draws.length, stats });
  } catch (err) {
    console.error("Error fetching draw history:", err);
    res.status(500).json({ error: "Failed to fetch draw history." });
  }
});

// ============================================================
// GET /api/draws/:drawNumber
// Returns a specific draw by number (enriched)
// ============================================================
import { drawEnricher } from "../../scraper/drawEnricher.js";

router.get("/:drawNumber", async (req: Request, res: Response) => {
  const drawNumber = parseInt(String(req.params.drawNumber ?? ""), 10);
  if (isNaN(drawNumber)) {
    res.status(400).json({ error: "Invalid draw number." });
    return;
  }

  try {
    let draw = await prisma.expressEntryDraw.findUnique({
      where: { drawNumber },
    });

    if (!draw) {
      res.status(404).json({ error: `Draw #${drawNumber} not found.` });
      return;
    }

    // Auto-enrich if not enriched yet (missing category or analysis)
    if (!draw.drawCategory || !draw.drawAnalysis) {
      const enriched = await drawEnricher.enrichDraw(draw);
      draw = await prisma.expressEntryDraw.update({
        where: { id: draw.id },
        data: enriched as any
      });
    }

    // Add historical context
    const similarDraws = await prisma.expressEntryDraw.findMany({
      where: { 
        drawType: draw.drawType,
        drawDate: { lt: draw.drawDate }
      },
      orderBy: { drawDate: "desc" },
      take: 5
    });

    let historicalContext = null;
    if (similarDraws.length > 0) {
      const avgCrsForThisType = Math.round(similarDraws.reduce((sum, d) => sum + d.crsScore, 0) / similarDraws.length);
      const diff = draw.crsScore - avgCrsForThisType;
      
      historicalContext = {
        avgCrsForThisType,
        thisDrawVsAvg: diff,
        trend: diff < 0 ? "decreasing" : diff > 0 ? "increasing" : "stable",
        lastSimilarDraw: {
          date: similarDraws[0].drawDate.toISOString(),
          crs: similarDraws[0].crsScore
        }
      };
    }

    res.json({ draw, historicalContext });
  } catch (err) {
    console.error("Error fetching draw:", err);
    res.status(500).json({ error: "Failed to fetch draw." });
  }
});

// ============================================================
// POST /api/draws/webhook/new-draw
// Manually trigger a draw check (protected)
// ============================================================
router.post("/webhook/new-draw", requireApiKey, async (_req: Request, res: Response) => {
  try {
    const result = await checkForNewDraws();
    res.json({
      success: true,
      newDraws: result.newDraws.length,
      totalFound: result.totalFound,
      newDrawDetails: result.newDraws,
    });
  } catch (err) {
    console.error("Error checking for new draws:", err);
    res.status(500).json({ error: "Draw check failed." });
  }
});

export default router;
