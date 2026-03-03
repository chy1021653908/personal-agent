import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { Document as LangChainDocument } from "@langchain/core/documents";
import type { Where } from "chromadb";
import { eq } from "drizzle-orm";
import { loadDocument, loadUrl } from "./loaders";
import { splitText } from "./splitter";
import { createVectorStore } from "./vector-store";

export async function indexDocument(documentId: string) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId));

  if (!doc) throw new Error("Document not found");

  await db
    .update(documents)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(documents.id, documentId));

  try {
    const storagePath =
      (doc.metadata as Record<string, string>)?.storagePath || "";

    let text: string;
    if (doc.fileType === "url") {
      text = await loadUrl(doc.fileUrl!);
    } else {
      text = await loadDocument(storagePath, doc.fileType);
    }

    const chunks = await splitText(text);

    if (chunks.length === 0) {
      throw new Error("No content extracted from document");
    }

    const vectorStore = createVectorStore(doc.knowledgeBaseId);
    await vectorStore.delete({
      filter: { documentId } as Where,
    });

    const batchSize = 100;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batchChunks = chunks.slice(i, i + batchSize);
      const batchDocuments = batchChunks.map(
        (chunk) =>
          new LangChainDocument({
            pageContent: chunk.content,
            metadata: {
              documentId,
              folderId: doc.folderId || "",
              fileName: doc.name,
              fileType: doc.fileType,
              chunkIndex: chunk.index,
            },
          })
      );

      await vectorStore.addDocuments(batchDocuments, {
        ids: batchChunks.map((_, idx) => `${documentId}_${i + idx}`),
      });
    }

    await db
      .update(documents)
      .set({
        status: "ready",
        chunkCount: chunks.length,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId));

    return { chunkCount: chunks.length };
  } catch (error) {
    console.error(`Indexing failed for document ${documentId}:`, error);
    await db
      .update(documents)
      .set({
        status: "error",
        metadata: {
          ...(doc.metadata as Record<string, unknown>),
          error: error instanceof Error ? error.message : "Unknown error",
        },
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId));
    throw error;
  }
}
