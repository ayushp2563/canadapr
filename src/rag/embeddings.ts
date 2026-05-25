import { Mistral } from "@mistralai/mistralai";
import OpenAI from "openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";
import { RAG_CONFIG } from "../config/models.js";
import { getVectorStore } from "./vectorStore.js";
import type { ScrapedPage } from "../scraper/irccScraper.js";

const prisma = new PrismaClient();

// ============================================================
// Embedding Provider Selection
//
// Priority:
//   1. OpenAI text-embedding-3-small  (if real OPENAI_API_KEY)
//   2. Mistral mistral-embed           (default — we have a key)
//
// Note: Groq does NOT offer embedding models (as of 2025).
// ============================================================

/** Returns true only if the key looks real (not a placeholder) */
function isRealKey(key: string | undefined): key is string {
  if (!key) return false;
  if (key.includes("xxx") || key.includes("your-") || key === "changeme") return false;
  if (key.length < 30) return false;
  return true;
}

type Provider = "openai" | "mistral";

interface EmbeddingAdapter {
  provider: Provider;
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(query: string): Promise<number[]>;
}

let _adapter: EmbeddingAdapter | null = null;

function getAdapter(): EmbeddingAdapter {
  if (_adapter) return _adapter;

  if (isRealKey(env.OPENAI_API_KEY)) {
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    console.log("✅ Using OpenAI embeddings (text-embedding-3-small)");
    _adapter = {
      provider: "openai",
      async embedDocuments(texts) {
        const res = await client.embeddings.create({
          model: "text-embedding-3-small",
          input: texts,
        });
        return res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
      },
      async embedQuery(query) {
        const res = await client.embeddings.create({
          model: "text-embedding-3-small",
          input: [query],
        });
        return res.data[0]!.embedding;
      },
    };
  } else {
    const client = new Mistral({ apiKey: env.MISTRAL_API_KEY });
    console.log("✅ Using Mistral embeddings (mistral-embed, 1024-dim)");
    _adapter = {
      provider: "mistral",
      async embedDocuments(texts: string[]) {
        // Mistral supports batch embedding
        const res = await client.embeddings.create({
          model: "mistral-embed",
          inputs: texts,
        });
        
        const sortedData = [...res.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
        return sortedData.map((d) => d.embedding as number[]);
      },
      async embedQuery(query: string) {
        const res = await client.embeddings.create({
          model: "mistral-embed",
          inputs: [query],
        });
        return res.data[0]!.embedding as number[];
      },
    };
  }

  return _adapter;
}

// ============================================================
// Public API
// ============================================================
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  return getAdapter().embedDocuments(texts);
}

export async function embedQuery(query: string): Promise<number[]> {
  return getAdapter().embedQuery(query);
}

// ============================================================
// Text Splitter
// ============================================================
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: RAG_CONFIG.chunkSize,
  chunkOverlap: RAG_CONFIG.chunkOverlap,
  separators: ["\n\n", "\n", ". ", " ", ""],
});

// ============================================================
// Document Metadata Type
// ============================================================
export interface ChunkMetadata {
  source_url: string;
  scrape_date: string;
  pathway_type: string;
  province?: string;
  title: string;
}

// ============================================================
// Embed a Single Scraped Page into ChromaDB
// ============================================================
export async function embedPage(page: ScrapedPage): Promise<number> {
  const vectorStore = await getVectorStore();

  const docs = await textSplitter.createDocuments(
    [page.content],
    [
      {
        source_url: page.url,
        scrape_date: page.scrapedAt.toISOString(),
        pathway_type: page.pathwayType,
        province: page.province ?? undefined,
        title: page.title,
      } satisfies ChunkMetadata,
    ]
  );

  if (docs.length === 0) return 0;

  const texts = docs.map((d) => d.pageContent);
  const embeddings = await embedDocuments(texts);

  await vectorStore.addDocuments(
    docs.map((doc) => ({
      pageContent: doc.pageContent,
      metadata: doc.metadata as Record<string, unknown>,
    })),
    { embeddings }
  );

  return docs.length;
}

// ============================================================
// Embed All Unembedded Announcements from DB
// ============================================================
export async function embedNewContent(): Promise<void> {
  console.log("🧠 Embedding new IRCC content...");

  const unembedded = await prisma.irccAnnouncement.findMany({
    where: { embedded: false },
    orderBy: { publishDate: "desc" },
    take: 100,
  });

  if (unembedded.length === 0) {
    console.log("✅ No new content to embed.");
    return;
  }

  const vectorStore = await getVectorStore();
  let totalChunks = 0;
  let failCount = 0;

  for (const ann of unembedded) {
    try {
      const combinedText = `${ann.title}\n\n${ann.content}`;
      const docs = await textSplitter.createDocuments(
        [combinedText],
        [
          {
            source_url: ann.url,
            scrape_date: ann.publishDate.toISOString(),
            pathway_type: ann.category,
            title: ann.title,
          },
        ]
      );

      if (docs.length === 0) continue;

      const texts = docs.map((d) => d.pageContent);
      const embeddings = await embedDocuments(texts);

      await vectorStore.addDocuments(
        docs.map((doc) => ({
          pageContent: doc.pageContent,
          metadata: doc.metadata as Record<string, unknown>,
        })),
        { embeddings }
      );

      await prisma.irccAnnouncement.update({
        where: { id: ann.id },
        data: { embedded: true },
      });

      totalChunks += docs.length;
      process.stdout.write(`  ✓ ${ann.title.substring(0, 70)}\n`);
    } catch (err) {
      failCount++;
      console.error(`  ❌ Failed [${ann.id}]: ${(err as Error).message}`);
    }
  }

  console.log(
    `\n✅ Done. ${unembedded.length - failCount}/${unembedded.length} announcements embedded → ${totalChunks} chunks.`
  );
}

// ============================================================
// Standalone runner (npm run embed:all)
// ============================================================
const isMain =
  process.argv[1]?.endsWith("embeddings.ts") ||
  process.argv[1]?.endsWith("embeddings.js");

if (isMain) {
  embedNewContent()
    .then(() => {
      void prisma.$disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
