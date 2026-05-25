import { chromium, type Browser, type Page } from "playwright";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================
// IRCC Source URLs
// ============================================================
export const IRCC_URLS = {
  expressEntry: {
    draws:
      "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/submit-profile/rounds-invitations.html",
    eligibility:
      "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility.html",
    crsCalculator:
      "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/criteria-comprehensive-ranking-system/grid.html",
  },
  pnp: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/provincial-nominees.html",
  family:
    "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/family-sponsorship.html",
  news: "https://www.canada.ca/en/immigration-refugees-citizenship/news.html",
  rss: "https://www.canada.ca/en/immigration-refugees-citizenship/news.atom",
  startupVisa:
    "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/start-visa.html",
  caregiver:
    "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/caregivers.html",
  atlantic:
    "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/atlantic-immigration.html",
  ruralNorthern:
    "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/rural-northern-immigration-pilot.html",
} as const;

// ============================================================
// Types
// ============================================================
export interface ScrapedPage {
  url: string;
  title: string;
  content: string;
  pathwayType: string;
  province?: string;
  scrapedAt: Date;
}

// ============================================================
// Browser Management
// ============================================================
let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browser;
}

async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

// ============================================================
// Scrape a Single Page
// ============================================================
async function scrapePage(url: string, pathwayType: string, province?: string): Promise<ScrapedPage> {
  const b = await getBrowser();
  const page: Page = await b.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector("main, #wb-cont, .container", { timeout: 10000 }).catch(() => {});

    const html = await page.content();
    const $ = cheerio.load(html);

    // Remove nav, header, footer, scripts, styles
    $("nav, header, footer, script, style, .wb-share, .pagedetails").remove();

    const title = $("h1").first().text().trim() || $("title").text().trim();
    const mainContent = $("#wb-cont, main, .container").first();
    const content = mainContent.text().replace(/\s+/g, " ").trim();

    return {
      url,
      title,
      content: content.substring(0, 50000), // cap at 50k chars
      pathwayType,
      province,
      scrapedAt: new Date(),
    };
  } finally {
    await page.close();
  }
}

// ============================================================
// Scrape All IRCC Pages
// ============================================================
export async function scrapeAll(): Promise<ScrapedPage[]> {
  console.log("🇨🇦 Starting full IRCC scrape...");
  const results: ScrapedPage[] = [];

  const targets: { url: string; pathwayType: string; province?: string }[] = [
    { url: IRCC_URLS.expressEntry.eligibility, pathwayType: "express_entry" },
    { url: IRCC_URLS.expressEntry.crsCalculator, pathwayType: "express_entry_crs" },
    { url: IRCC_URLS.pnp, pathwayType: "pnp" },
    { url: IRCC_URLS.family, pathwayType: "family_sponsorship" },
    { url: IRCC_URLS.startupVisa, pathwayType: "startup_visa" },
    { url: IRCC_URLS.caregiver, pathwayType: "caregiver" },
    { url: IRCC_URLS.atlantic, pathwayType: "atlantic_immigration" },
    { url: IRCC_URLS.ruralNorthern, pathwayType: "rural_northern" },
    { url: IRCC_URLS.news, pathwayType: "news" },
  ];

  for (const target of targets) {
    try {
      console.log(`  Scraping: ${target.pathwayType} → ${target.url}`);
      const page = await scrapePage(target.url, target.pathwayType, target.province);
      results.push(page);

      await prisma.scraperRun.create({
        data: {
          source: target.url,
          status: "success",
          itemsFound: 1,
        },
      });
    } catch (err) {
      console.error(`  ❌ Failed to scrape ${target.url}:`, err);
      await prisma.scraperRun.create({
        data: {
          source: target.url,
          status: "failed",
          itemsFound: 0,
        },
      });
    }
  }

  await closeBrowser();
  console.log(`✅ Scrape complete. ${results.length}/${targets.length} pages scraped.`);
  return results;
}

// ============================================================
// Scrape News / Announcements Page
// ============================================================
export async function scrapeAnnouncements(): Promise<void> {
  console.log("📰 Scraping IRCC announcements...");
  const b = await getBrowser();
  const page: Page = await b.newPage();

  try {
    await page.goto(IRCC_URLS.news, { waitUntil: "networkidle", timeout: 45000 });

    // Wait for news article links to appear
    await page.waitForSelector("article a, .news-results a, li a[href*='ircc'], li a[href*='immigration']", {
      timeout: 15000,
    }).catch(() => {});

    const html = await page.content();
    const $ = cheerio.load(html);

    const seen = new Set<string>();
    const announcements: {
      title: string;
      url: string;
      publishDate: Date;
      content: string;
      category: string;
    }[] = [];

    // Canada.ca WET news listing selectors (broad coverage)
    const selectors = [
      "article",
      ".news-results li",
      ".col-md-8 li",
      "ul.list-unstyled li",
      ".mwsbodytext li",
      "main li",
    ];

    for (const sel of selectors) {
      $(sel).each((_, el) => {
        const link = $(el).find("a[href*='/news/'], a[href*='/ircc/'], a[href*='immigration']").first()
          || $(el).find("a").first();
        const title = link.text().trim();
        const href = link.attr("href");
        if (!title || !href || title.length < 10) return;

        const fullUrl = href.startsWith("http") ? href : `https://www.canada.ca${href}`;
        if (seen.has(fullUrl)) return;
        seen.add(fullUrl);

        // Try to find a date
        const dateStr = $(el).find("time, [class*='date'], [class*='Date']").first().attr("datetime")
          ?? $(el).find("time, [class*='date']").first().text().trim()
          ?? "";
        const date = dateStr ? new Date(dateStr) : new Date();

        const category = title.toLowerCase().includes("policy") || title.toLowerCase().includes("regulation")
          ? "policy-change"
          : title.toLowerCase().includes("notice") || title.toLowerCase().includes("update")
          ? "notice"
          : "news";

        announcements.push({
          title,
          url: fullUrl,
          publishDate: isNaN(date.getTime()) ? new Date() : date,
          content: $(el).text().replace(/\s+/g, " ").trim().substring(0, 5000),
          category,
        });
      });

      if (announcements.length >= 20) break;
    }

    // Upsert to DB
    let savedCount = 0;
    for (const ann of announcements.slice(0, 30)) {
      try {
        await prisma.irccAnnouncement.upsert({
          where: { url: ann.url },
          create: ann,
          update: { title: ann.title, publishDate: ann.publishDate },
        });
        savedCount++;
      } catch { /* skip duplicates */ }
    }

    console.log(`✅ Saved ${savedCount}/${announcements.length} announcements.`);
  } finally {
    await page.close();
    await closeBrowser();
  }
}


// ============================================================
// Standalone runner (called by npm run scrape:once)
// ============================================================
const isMain =
  process.argv[1]?.endsWith("irccScraper.ts") ||
  process.argv[1]?.endsWith("irccScraper.js");

if (isMain) {
  (async () => {
    console.log("🚀 Running one-off IRCC scrape...");
    await scrapeAll();
    await scrapeAnnouncements();
    await prisma.$disconnect();
    console.log("✅ Done. Disconnect from DB.");
    process.exit(0);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
