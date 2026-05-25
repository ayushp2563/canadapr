import { ChromaClient, Collection } from "chromadb";
import { env } from "../config/env.js";

// ============================================================
// ChromaDB Client Singleton
// ============================================================
let chromaClient: ChromaClient | null = null;
let collection: Collection | null = null;

export function getChromaClient(): ChromaClient {
  if (!chromaClient) {
    chromaClient = new ChromaClient({ path: env.CHROMA_URL });
  }
  return chromaClient;
}

// ============================================================
// Get or Create Collection
// ============================================================
export async function getCollection(): Promise<Collection> {
  if (collection) return collection;

  const client = getChromaClient();
  collection = await client.getOrCreateCollection({
    name: env.CHROMA_COLLECTION,
    metadata: {
      description: "IRCC immigration content for RAG",
      "hnsw:space": "cosine",
    },
  });

  return collection;
}

// ============================================================
// Minimal VectorStore wrapper (compatible with LangChain style)
// ============================================================
export interface VectorDocument {
  pageContent: string;
  metadata: Record<string, unknown>;
}

export interface VectorStoreWrapper {
  addDocuments(
    docs: VectorDocument[],
    options?: { embeddings?: number[][] }
  ): Promise<void>;
  similaritySearch(
    queryEmbedding: number[],
    k?: number,
    filter?: Record<string, string>
  ): Promise<VectorDocument[]>;
  deleteCollection(): Promise<void>;
  count(): Promise<number>;
}

export async function getVectorStore(): Promise<VectorStoreWrapper> {
  const col = await getCollection();

  return {
    async addDocuments(docs, options) {
      if (docs.length === 0) return;

      const ids = docs.map(
        (_, i) => `doc_${Date.now()}_${i}_${Math.random().toString(36).slice(2)}`
      );
      const documents = docs.map((d) => d.pageContent);
      const metadatas = docs.map((d) =>
        Object.fromEntries(
          Object.entries(d.metadata).map(([k, v]) => [
            k,
            v === null || v === undefined ? "" : String(v),
          ])
        )
      );

      if (options?.embeddings) {
        await col.add({ ids, documents, metadatas, embeddings: options.embeddings });
      } else {
        await col.add({ ids, documents, metadatas });
      }
    },

    async similaritySearch(queryEmbedding, k = 5, filter) {
      const results = await col.query({
        queryEmbeddings: [queryEmbedding],
        nResults: k,
        where: filter,
      });

      const docs: VectorDocument[] = [];
      const documents = results.documents?.[0] ?? [];
      const metadatas = results.metadatas?.[0] ?? [];

      for (let i = 0; i < documents.length; i++) {
        const content = documents[i];
        if (!content) continue;
        docs.push({
          pageContent: content,
          metadata: (metadatas[i] as Record<string, unknown>) ?? {},
        });
      }

      return docs;
    },

    async deleteCollection() {
      const client = getChromaClient();
      await client.deleteCollection({ name: env.CHROMA_COLLECTION });
      collection = null;
    },

    async count() {
      return col.count();
    },
  };
}

// ============================================================
// Health Check
// ============================================================
export async function checkChromaHealth(): Promise<boolean> {
  try {
    const client = getChromaClient();
    await client.heartbeat();
    return true;
  } catch {
    return false;
  }
}
