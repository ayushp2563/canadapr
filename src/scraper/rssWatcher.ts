import { parseDocument } from "htmlparser2";
import { findAll, getAttributeValue, textContent } from "domutils";
import { PrismaClient } from "@prisma/client";
import { IRCC_URLS } from "./irccScraper.js";

const prisma = new PrismaClient();

// ============================================================
// Feed Item Type
// ============================================================
interface FeedItem {
  title: string;
  link: string;
  publishDate: Date;
  content: string;
  category: string;
}

// ============================================================
// Fetch + lenient-parse the IRCC Atom feed with htmlparser2
//
// rss-parser / sax.js fail on IRCC's Atom feed because it
// contains unescaped &, ", and other invalid XML chars.
// htmlparser2 is designed for broken markup and handles it.
// ============================================================
async function fetchAndParseAtomFeed(): Promise<FeedItem[]> {
  const res = await fetch(IRCC_URLS.rss, {
    headers: {
      "User-Agent":
        "CanadaPathwaysBot/1.0 (Immigration Assistant; contact@canadapathways.ai)",
      Accept: "application/atom+xml, application/rss+xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} fetching RSS feed`);

  const rawXml = await res.text();

  // Parse with htmlparser2 in XML mode (lenient)
  const dom = parseDocument(rawXml, {
    xmlMode: false, // false = lenient HTML mode — handles malformed XML
    decodeEntities: true,
    lowerCaseTags: true,
    recognizeSelfClosing: true,
  });

  const items: FeedItem[] = [];

  // Find <entry> (Atom) or <item> (RSS) elements
  const entries = findAll(
    (el) => el.type === "tag" && (el.name === "entry" || el.name === "item"),
    dom.children
  );

  for (const entry of entries) {
    // Title: <title> text
    const titleEl = findAll((el) => el.type === "tag" && el.name === "title", entry.children).shift();
    const title = titleEl ? textContent(titleEl).trim() : "";

    // Link: <link href="..."> or <link>url</link>
    const linkEls = findAll((el) => el.type === "tag" && el.name === "link", entry.children);
    let link = "";
    for (const linkEl of linkEls) {
      const href = getAttributeValue(linkEl, "href");
      if (href) { link = href; break; }
      const text = textContent(linkEl).trim();
      if (text.startsWith("http")) { link = text; break; }
    }

    if (!title || !link) continue;

    // Date: <published>, <updated>, or <pubdate>
    const dateTagNames = ["published", "updated", "pubdate", "dc:date"];
    let publishDate = new Date();
    for (const tagName of dateTagNames) {
      const dateEl = findAll((el) => el.type === "tag" && el.name === tagName, entry.children).shift();
      if (dateEl) {
        const d = new Date(textContent(dateEl).trim());
        if (!isNaN(d.getTime())) { publishDate = d; break; }
      }
    }

    // Content: <content>, <summary>, or <description>
    const contentTagNames = ["content", "summary", "description"];
    let content = "";
    for (const tagName of contentTagNames) {
      const contentEl = findAll((el) => el.type === "tag" && el.name === tagName, entry.children).shift();
      if (contentEl) {
        content = textContent(contentEl).trim();
        break;
      }
    }

    const category = classifyCategory(title, content);

    items.push({ title, link, publishDate, content: content.substring(0, 10000), category });
  }

  return items;
}

// ============================================================
// Classify Announcement Category
// ============================================================
function classifyCategory(title: string, content: string): string {
  const text = `${title} ${content}`.toLowerCase();

  if (
    text.includes("policy") ||
    text.includes("regulation") ||
    text.includes("ministerial instruction") ||
    text.includes("bill")
  ) {
    return "policy-change";
  }

  if (
    text.includes("notice") ||
    text.includes("update") ||
    text.includes("alert") ||
    text.includes("disruption")
  ) {
    return "notice";
  }

  return "news";
}

// ============================================================
// Check RSS Feed for New Items
// ============================================================
export async function checkFeed(): Promise<number> {
  console.log("📡 Checking IRCC RSS feed...");

  try {
    const items = await fetchAndParseAtomFeed();
    let savedCount = 0;

    for (const item of items.slice(0, 50)) {
      try {
        await prisma.irccAnnouncement.upsert({
          where: { url: item.link },
          create: {
            title: item.title,
            url: item.link,
            publishDate: item.publishDate,
            content: item.content,
            category: item.category,
            embedded: false,
          },
          update: {
            title: item.title,
            publishDate: item.publishDate,
          },
        });
        savedCount++;
      } catch {
        // Skip duplicates / unique constraint violations
      }
    }

    await prisma.scraperRun.create({
      data: {
        source: IRCC_URLS.rss,
        status: "success",
        itemsFound: savedCount,
      },
    });

    console.log(`✅ RSS check complete. ${items.length} items found, ${savedCount} saved.`);
    return savedCount;
  } catch (err) {
    console.error("❌ RSS feed check failed:", err);
    await prisma.scraperRun.create({
      data: {
        source: IRCC_URLS.rss,
        status: "failed",
        itemsFound: 0,
      },
    });
    // Non-fatal: don't crash the scheduler
    return 0;
  }
}

// ============================================================
// Standalone runner
// ============================================================
const isMain =
  process.argv[1]?.endsWith("rssWatcher.ts") ||
  process.argv[1]?.endsWith("rssWatcher.js");

if (isMain) {
  checkFeed()
    .then((n) => {
      console.log(`Done. Processed ${n} items.`);
      void prisma.$disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
