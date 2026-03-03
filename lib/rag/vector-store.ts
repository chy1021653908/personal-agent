import { Chroma } from "@langchain/community/vectorstores/chroma";
import type { Where } from "chromadb";
import { getEmbeddingsModel } from "./embeddings";

export function getCollectionName(knowledgeBaseId: string): string {
  return `kb_${knowledgeBaseId}`;
}

export function createVectorStore(
  knowledgeBaseId: string,
  filter?: Where
): Chroma {
  return new Chroma(getEmbeddingsModel(), {
    collectionName: getCollectionName(knowledgeBaseId),
    url: process.env.CHROMA_API_URL || "http://localhost:8000",
    ...(filter ? { filter: filter as object } : {}),
  });
}
