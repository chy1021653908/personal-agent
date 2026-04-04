import { Chroma } from "@langchain/community/vectorstores/chroma";
import type { Where } from "chromadb";
import { getEmbeddingsModel } from "./embeddings";
import { getChromaClient } from "./chroma";

export function getCollectionName(knowledgeBaseId: string): string {
  return `kb_${knowledgeBaseId}`;
}

export function createVectorStore(
  knowledgeBaseId: string,
  filter?: Where
): Chroma {
  return new Chroma(getEmbeddingsModel(), {
    collectionName: getCollectionName(knowledgeBaseId),
    index: getChromaClient(),
    ...(filter ? { filter: filter as object } : {}),
  });
}
