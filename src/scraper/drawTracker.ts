import { chromium, type Browser, type Page } from "playwright";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";
import { IRCC_URLS } from "./irccScraper.js";
import { env } from "../config/env.js";

const prisma = new PrismaClient();

// ============================================================
// Types
// ============================================================
export interface ParsedDraw {
  drawNumber: number;
  drawDate: Date;
  drawType: string;
  crsScore: number;
  invitationsIssued: number;
  tieBreakingRule?: Date;
}

// ============================================================
// Parse Draw Table Row
// ============================================================
function parseDrawRow($: cheerio.Root, row: cheerio.Element): ParsedDraw | null {
  const cells = $(row).find("td");
  if (cells.length < 4) return null;

  const getText = (i: number) => $(cells.get(i)!).text().replace(/\s+/g, " ").trim();

  try {
    // Column order from IRCC table:
    // Draw # | Date | Draw type | CRS score | Invitations
    const rawDrawNum = getText(0).replace(/[^\d]/g, "");
    const rawDate = getText(1);
    const drawType = getText(2) || "No program specified";
    const rawCrs = getText(3).replace(/[^\d]/g, "");
    const rawInvitations = getText(4).replace(/[^\d,]/g, "").replace(/,/g, "");
    const rawTiebreak = getText(5);

    const drawNumber = parseInt(rawDrawNum, 10);
    const crsScore = parseInt(rawCrs, 10);
    const invitationsIssued = parseInt(rawInvitations, 10);

    if (isNaN(drawNumber) || isNaN(crsScore) || isNaN(invitationsIssued)) return null;

    const drawDate = new Date(rawDate);
    if (isNaN(drawDate.getTime())) return null;

    let tieBreakingRule: Date | undefined;
    if (rawTiebreak && rawTiebreak !== "N/A") {
      const d = new Date(rawTiebreak);
      if (!isNaN(d.getTime())) tieBreakingRule = d;
    }

    return { drawNumber, drawDate, drawType, crsScore, invitationsIssued, tieBreakingRule };
  } catch {
    return null;
  }
}

// ============================================================
// Extract CRS Score from Text (for unit testing)
// ============================================================
export function extractCrsScore(text: string): number | null {
  // Patterns: "CRS score: 524", "minimum score of 524", "lowest score was 524"
  const patterns = [
    /crs\s+(?:score|cutoff)[:\s]+(\d{3})/i,
    /minimum\s+score\s+(?:of\s+)?(\d{3})/i,
    /lowest\s+(?:crs\s+)?score\s+(?:was\s+)?(\d{3})/i,
    /score\s+(?:of\s+)?(\d{3})/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) {
      const score = parseInt(match[1], 10);
      if (score >= 300 && score <= 1200) return score;
    }
  }
  return null;
}

// ============================================================
// Scrape Express Entry Draws via IRCC Open Data JSON API
// This is more reliable than screen-scraping the HTML table
// ============================================================
const IRCC_DRAWS_JSON_URL =
  "https://www.canada.ca/content/dam/ircc/documents/json/ee_rounds_123_en.json";

async function fetchDrawsFromJson(): Promise<ParsedDraw[]> {
  const res = await fetch(IRCC_DRAWS_JSON_URL, {
    headers: {
      "User-Agent": "CanadaPathwaysBot/1.0",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} fetching draws JSON`);

  const data = (await res.json()) as {
    rounds?: Array<{
      drawNumber: string;
      drawDate: string;
      drawName: string;
      drawCRS: string;
      drawSize: string;
      drawDateFull: string;
    }>;
  };

  const rounds = data.rounds ?? [];
  const draws: ParsedDraw[] = [];

  for (const r of rounds) {
    const drawNumber = parseInt(r.drawNumber, 10);
    const crsScore = parseInt(r.drawCRS, 10);
    const invitationsIssued = parseInt((r.drawSize ?? "").replace(/,/g, ""), 10);
    const drawDate = new Date(r.drawDateFull ?? r.drawDate);

    if (isNaN(drawNumber) || isNaN(crsScore) || isNaN(invitationsIssued)) continue;
    if (isNaN(drawDate.getTime())) continue;

    draws.push({
      drawNumber,
      drawDate,
      drawType: r.drawName || "No program specified",
      crsScore,
      invitationsIssued,
    });
  }

  return draws;
}

// ============================================================
// Scrape Express Entry Draws Page (Playwright fallback)
// ============================================================
export async function scrapeDrawsPage(): Promise<ParsedDraw[]> {
  // Try the JSON API first — much faster and more reliable
  try {
    console.log("  Trying IRCC open data JSON API...");
    const draws = await fetchDrawsFromJson();
    if (draws.length > 0) {
      console.log(`  ✓ Got ${draws.length} draws from JSON API`);
      return draws;
    }
    console.log("  JSON API returned 0 draws, falling back to Playwright...");
  } catch (jsonErr) {
    console.warn("  JSON API failed, falling back to Playwright:", (jsonErr as Error).message);
  }

  // Fallback: Playwright HTML scrape
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    page = await browser.newPage();

    // Block images/fonts to speed up load
    await page.route("**/*.{png,jpg,gif,webp,svg,woff,woff2,ttf}", (route) => route.abort());

    await page.goto(IRCC_URLS.expressEntry.draws, {
      waitUntil: "networkidle",
      timeout: 45000,
    });

    // Wait for actual table rows (not just the <table> element)
    await page
      .waitForSelector("table tbody tr td", { timeout: 20000 })
      .catch(() => {
        console.warn("  Table rows not found within timeout — parsing whatever loaded");
      });

    // Extra wait for any lazy JS rendering
    await page.waitForTimeout(2000);

    const html = await page.content();
    const $ = cheerio.load(html);

    const draws: ParsedDraw[] = [];

    // IRCC uses multiple tables per year — iterate all
    $("table").each((_, table) => {
      $(table)
        .find("tbody tr")
        .each((_, row) => {
          const draw = parseDrawRow($, row);
          if (draw) draws.push(draw);
        });
    });

    console.log(`  ✓ Playwright found ${draws.length} draws`);
    return draws;
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
}

// ============================================================
// Check for New Draws & Upsert to DB
// ============================================================
export async function checkForNewDraws(): Promise<{
  newDraws: ParsedDraw[];
  totalFound: number;
}> {
  console.log("🗳️  Checking for new Express Entry draws...");

  try {
    const draws = await scrapeDrawsPage();
    const newDraws: ParsedDraw[] = [];

    for (const draw of draws) {
      const result = await prisma.expressEntryDraw.upsert({
        where: { drawNumber: draw.drawNumber },
        create: {
          drawNumber: draw.drawNumber,
          drawDate: draw.drawDate,
          drawType: draw.drawType,
          crsScore: draw.crsScore,
          invitationsIssued: draw.invitationsIssued,
          tieBreakingRule: draw.tieBreakingRule ?? null,
        },
        update: {
          drawType: draw.drawType,
          crsScore: draw.crsScore,
          invitationsIssued: draw.invitationsIssued,
        },
      });

      // If newly inserted (createdAt === updatedAt within a second)
      const isNew =
        Math.abs(result.createdAt.getTime() - result.updatedAt.getTime()) < 1000;
      if (isNew) newDraws.push(draw);
    }

    // Send alert if new draws found
    if (newDraws.length > 0 && env.ALERT_WEBHOOK_URL) {
      await sendDrawAlert(newDraws);
    }

    await prisma.scraperRun.create({
      data: {
        source: IRCC_URLS.expressEntry.draws,
        status: "success",
        itemsFound: draws.length,
      },
    });

    console.log(
      `✅ Draw check complete. ${draws.length} total, ${newDraws.length} new.`
    );
    return { newDraws, totalFound: draws.length };
  } catch (err) {
    console.error("❌ Draw check failed:", err);
    await prisma.scraperRun.create({
      data: {
        source: IRCC_URLS.expressEntry.draws,
        status: "failed",
        itemsFound: 0,
      },
    });
    throw err;
  }
}

// ============================================================
// Send Alert (Slack/Discord Webhook)
// ============================================================
async function sendDrawAlert(draws: ParsedDraw[]): Promise<void> {
  if (!env.ALERT_WEBHOOK_URL) return;

  const text = draws
    .map(
      (d) =>
        `🇨🇦 New Express Entry Draw #${d.drawNumber}!\n` +
        `  Date: ${d.drawDate.toDateString()}\n` +
        `  Type: ${d.drawType}\n` +
        `  CRS Score: ${d.crsScore}\n` +
        `  Invitations: ${d.invitationsIssued.toLocaleString()}`
    )
    .join("\n\n");

  try {
    await fetch(env.ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    console.error("Failed to send draw alert:", err);
  }
}

// ============================================================
// Standalone runner (called by npm run draws:check)
// ============================================================
const isMain =
  process.argv[1]?.endsWith("drawTracker.ts") ||
  process.argv[1]?.endsWith("drawTracker.js");

if (isMain) {
  checkForNewDraws()
    .then(() => {
      void prisma.$disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
