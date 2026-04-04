import { ChromaClient, CloudClient } from "chromadb";

let client: ChromaClient | null = null;

export function getChromaClient(): ChromaClient {
  if (!client) {
    const apiKey = process.env.CHROMA_API_KEY;
    const tenant = process.env.CHROMA_TENANT;
    const database = process.env.CHROMA_DATABASE;

    if (apiKey && tenant && database) {
      client = new CloudClient({
        apiKey,
        tenant,
        database,
      });
    } else {
      client = new ChromaClient({
        path: process.env.CHROMA_API_URL || "http://localhost:8000",
      });
    }
  }
  return client;
}

export async function getOrCreateCollection(knowledgeBaseId: string) {
  const chromaClient = getChromaClient();
  return chromaClient.getOrCreateCollection({
    name: `kb_${knowledgeBaseId}`,
    metadata: { "hnsw:space": "cosine" },
  });
}

export async function deleteCollection(knowledgeBaseId: string) {
  const chromaClient = getChromaClient();
  try {
    await chromaClient.deleteCollection({ name: `kb_${knowledgeBaseId}` });
  } catch {
    // Collection may not exist
  }
}
