import type { Where } from "chromadb";
import { createVectorStore } from "./vector-store";

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
  let whereFilter: Where | undefined;

  if (scope === "folder" && scopeId) {
    whereFilter = { folderId: scopeId };
  } else if (scope === "document" && scopeId) {
    whereFilter = { documentId: scopeId };
  }

  const vectorStore = createVectorStore(knowledgeBaseId);
  const results = await vectorStore.similaritySearchWithScore(
    query,
    topK,
    whereFilter
  );

  return results.map(([doc, score]) => ({
    documentId: String(doc.metadata.documentId ?? ""),
    fileName: String(doc.metadata.fileName ?? ""),
    chunkIndex:
      typeof doc.metadata.chunkIndex === "number"
        ? doc.metadata.chunkIndex
        : Number(doc.metadata.chunkIndex ?? 0),
    content: doc.pageContent,
    distance: score,
  }));
}
