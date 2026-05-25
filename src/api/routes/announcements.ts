import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const router = Router();
const prisma = new PrismaClient();

// ============================================================
// GET /api/announcements/latest
// Returns latest IRCC announcements
// ============================================================
const latestQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  category: z.enum(["news", "notice", "policy-change"]).optional(),
});

router.get("/latest", async (req: Request, res: Response) => {
  const parsed = latestQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }

  const { limit, category } = parsed.data;

  try {
    const announcements = await prisma.irccAnnouncement.findMany({
      where: category ? { category } : undefined,
      orderBy: { publishDate: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        url: true,
        publishDate: true,
        category: true,
        createdAt: true,
      },
    });

    const lastScrape = await prisma.scraperRun.findFirst({
      where: { source: { contains: "news" } },
      orderBy: { runAt: "desc" },
    });

    res.json({
      announcements,
      count: announcements.length,
      lastUpdated: lastScrape?.runAt ?? null,
    });
  } catch (err) {
    console.error("Error fetching announcements:", err);
    res.status(500).json({ error: "Failed to fetch announcements." });
  }
});

export default router;
