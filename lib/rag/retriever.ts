import { embedQuery } from "./embeddings";
import { getOrCreateCollection } from "./chroma";
import type { Where } from "chromadb";

export interface RetrievalResult {
  documentId: string;
  fileName: string;
  chunkIndex: number;
  content: string;
  distance: number;
}

interface RetrieveOptions {
  knowledgeBaseId: string;
  query: string;
  topK?: number;
  scope?: "knowledge_base" | "folder" | "document";
  scopeId?: string;
}

export async function retrieve({
  knowledgeBaseId,
  query,
  topK = 5,
  scope,
  scopeId,
}: RetrieveOptions): Promise<RetrievalResult[]> {
  const queryEmbedding = await embedQuery(query);
  const collection = await getOrCreateCollection(knowledgeBaseId);

  let whereFilter: Where | undefined;

  if (scope === "folder" && scopeId) {
    whereFilter = { folderId: scopeId };
  } else if (scope === "document" && scopeId) {
    whereFilter = { documentId: scopeId };
  }

  const results = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: topK,
    where: whereFilter,
  });

  if (
    !results.ids[0] ||
    !results.documents[0] ||
    !results.metadatas[0]
  ) {
    return [];
  }

  return results.ids[0].map((_, i) => ({
    documentId: (results.metadatas[0][i]?.documentId as string) || "",
    fileName: (results.metadatas[0][i]?.fileName as string) || "",
    chunkIndex: (results.metadatas[0][i]?.chunkIndex as number) || 0,
    content: results.documents[0]![i] || "",
    distance: results.distances?.[0]?.[i] || 0,
  }));
}
