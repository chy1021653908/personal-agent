import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { loadDocument, loadUrl } from "./loaders";
import { splitText } from "./splitter";
import { embedTexts } from "./embeddings";
import { getOrCreateCollection } from "./chroma";

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

    const embeddings = await embedTexts(chunks.map((c) => c.content));

    const collection = await getOrCreateCollection(doc.knowledgeBaseId);

    const batchSize = 100;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batchChunks = chunks.slice(i, i + batchSize);
      const batchEmbeddings = embeddings.slice(i, i + batchSize);

      await collection.add({
        ids: batchChunks.map((_, idx) => `${documentId}_${i + idx}`),
        embeddings: batchEmbeddings,
        documents: batchChunks.map((c) => c.content),
        metadatas: batchChunks.map((c) => ({
          documentId,
          folderId: doc.folderId || "",
          fileName: doc.name,
          fileType: doc.fileType,
          chunkIndex: c.index,
        })),
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
