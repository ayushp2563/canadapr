import cron from "node-cron";
import { checkForNewDraws } from "../scraper/drawTracker.js";
import { scrapeAll } from "../scraper/irccScraper.js";
import { checkFeed } from "../scraper/rssWatcher.js";
import { embedNewContent } from "../rag/embeddings.js";

// ============================================================
// Job Runner with Error Isolation
// ============================================================
async function runJob(name: string, fn: () => Promise<unknown>): Promise<void> {
  const start = Date.now();
  console.log(`⏰ [${new Date().toISOString()}] Starting job: ${name}`);
  try {
    await fn();
    console.log(`✅ [${new Date().toISOString()}] Job '${name}' completed in ${Date.now() - start}ms`);
  } catch (err) {
    console.error(`❌ [${new Date().toISOString()}] Job '${name}' failed:`, err);
  }
}

// ============================================================
// Cron Jobs
// ============================================================
export function startScheduler(): void {
  console.log("⏱️  Starting scheduled jobs...");

  // Check for new Express Entry draws every 2 hours
  cron.schedule("0 */2 * * *", () => {
    void runJob("draw-check", checkForNewDraws);
  });

  // Re-scrape IRCC main pages daily at 6 AM UTC
  cron.schedule("0 6 * * *", () => {
    void runJob("ircc-scrape-all", scrapeAll);
  });

  // Check IRCC RSS feed every 30 minutes
  cron.schedule("*/30 * * * *", () => {
    void runJob("rss-check", checkFeed);
  });

  // Re-embed new content every night at 2 AM UTC
  cron.schedule("0 2 * * *", () => {
    void runJob("embed-new-content", embedNewContent);
  });

  console.log("✅ Scheduler ready. Jobs:");
  console.log("   - Draw check: every 2 hours");
  console.log("   - IRCC scrape: daily at 6 AM UTC");
  console.log("   - RSS check: every 30 minutes");
  console.log("   - Content embed: daily at 2 AM UTC");

  // Run initial checks on startup (staggered to avoid hammering)
  setTimeout(() => void runJob("startup:rss-check", checkFeed), 5000);
  setTimeout(() => void runJob("startup:draw-check", checkForNewDraws), 15000);
}
