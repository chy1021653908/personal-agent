import type { Where } from "chromadb";
import { deleteFile } from "@/lib/supabase/storage";
import { createVectorStore } from "./vector-store";

interface DocumentResourceTarget {
  id: string;
  knowledgeBaseId: string;
  metadata: Record<string, unknown> | null;
}

export async function deleteDocumentVectors(
  knowledgeBaseId: string,
  documentId: string
) {
  try {
    const vectorStore = createVectorStore(knowledgeBaseId);
    await vectorStore.delete({
      filter: { documentId } as Where,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const collectionMissing =
      message.includes("not found") || message.includes("does not exist");

    if (!collectionMissing) {
      throw error;
    }
  }
}

export async function deleteDocumentResources(target: DocumentResourceTarget) {
  await deleteDocumentVectors(target.knowledgeBaseId, target.id);

  const storagePath = target.metadata?.storagePath;
  if (typeof storagePath === "string" && storagePath.length > 0) {
    await deleteFile(storagePath);
  }
}
