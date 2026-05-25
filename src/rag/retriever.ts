import { getVectorStore } from "./vectorStore.js";
import { embedQuery } from "./embeddings.js";
import { RAG_CONFIG } from "../config/models.js";

// ============================================================
// Types
// ============================================================
export interface RetrievedChunk {
  content: string;
  sourceUrl: string;
  scrapeDate: string;
  pathwayType: string;
  province?: string;
  title: string;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  contextString: string;
  sourcesFormatted: SourceCitation[];
}

export interface SourceCitation {
  title: string;
  url: string;
  date: string;
  pathwayType: string;
}

// ============================================================
// Format Context for LLM Injection
// ============================================================
function formatContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";

  return chunks
    .map(
      (chunk, i) =>
        `[Source ${i + 1}] ${chunk.title} (${chunk.pathwayType})\n` +
        `URL: ${chunk.sourceUrl}\n` +
        `Date: ${new Date(chunk.scrapeDate).toLocaleDateString("en-CA")}\n\n` +
        chunk.content
    )
    .join("\n\n---\n\n");
}

// ============================================================
// Format Sources for API Response
// ============================================================
function formatSources(chunks: RetrievedChunk[]): SourceCitation[] {
  const seen = new Set<string>();
  const sources: SourceCitation[] = [];

  for (const chunk of chunks) {
    if (!seen.has(chunk.sourceUrl)) {
      seen.add(chunk.sourceUrl);
      sources.push({
        title: chunk.title,
        url: chunk.sourceUrl,
        date: chunk.scrapeDate,
        pathwayType: chunk.pathwayType,
      });
    }
  }

  return sources;
}

// ============================================================
// Main Retriever
// ============================================================
export async function retrieve(
  query: string,
  options: {
    topK?: number;
    pathwayTypeFilter?: string;
    provinceFilter?: string;
  } = {}
): Promise<RetrievalResult> {
  const topK = options.topK ?? RAG_CONFIG.topK;

  try {
    const vectorStore = await getVectorStore();

    // Embed the query
    const queryEmbedding = await embedQuery(query);

    // Build filter
    const filter: Record<string, string> = {};
    if (options.pathwayTypeFilter) {
      filter["pathway_type"] = options.pathwayTypeFilter;
    }
    if (options.provinceFilter) {
      filter["province"] = options.provinceFilter;
    }

    // Retrieve
    const docs = await vectorStore.similaritySearch(
      queryEmbedding,
      topK,
      Object.keys(filter).length > 0 ? filter : undefined
    );

    const chunks: RetrievedChunk[] = docs.map((doc) => ({
      content: doc.pageContent,
      sourceUrl: String(doc.metadata["source_url"] ?? ""),
      scrapeDate: String(doc.metadata["scrape_date"] ?? new Date().toISOString()),
      pathwayType: String(doc.metadata["pathway_type"] ?? "general"),
      province: doc.metadata["province"] ? String(doc.metadata["province"]) : undefined,
      title: String(doc.metadata["title"] ?? "IRCC Document"),
    }));

    const contextString = formatContext(chunks);
    const sourcesFormatted = formatSources(chunks);

    return { chunks, contextString, sourcesFormatted };
  } catch (err) {
    // If vector store unavailable, return empty context (graceful degradation)
    console.warn("RAG retrieval failed, proceeding without context:", err);
    return {
      chunks: [],
      contextString: "",
      sourcesFormatted: [],
    };
  }
}

// ============================================================
// Detect Pathway Type from Query (for smarter filtering)
// ============================================================
export function detectPathwayType(query: string): string | undefined {
  const lower = query.toLowerCase();

  if (lower.includes("express entry") || lower.includes("crs") || lower.includes("fsw") || lower.includes("cec") || lower.includes("fst")) {
    return "express_entry";
  }
  if (lower.includes("provincial") || lower.includes("pnp") || lower.includes("nominee")) {
    return "pnp";
  }
  if (lower.includes("family") || lower.includes("sponsor") || lower.includes("spouse") || lower.includes("parent")) {
    return "family_sponsorship";
  }
  if (lower.includes("startup") || lower.includes("start-up") || lower.includes("entrepreneur")) {
    return "startup_visa";
  }
  if (lower.includes("caregiver")) {
    return "caregiver";
  }
  if (lower.includes("atlantic")) {
    return "atlantic_immigration";
  }
  if (lower.includes("rural") || lower.includes("northern")) {
    return "rural_northern";
  }

  return undefined;
}
