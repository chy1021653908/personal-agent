import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, folders, knowledgeBases } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-utils";
import { and, eq, inArray } from "drizzle-orm";
import { deleteDocumentResources } from "@/lib/rag/document-cleanup";
import { z } from "zod";

const renameFolderSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

async function verifyKnowledgeBaseAccess(kbId: string, userId: string) {
  const [kb] = await db
    .select()
    .from(knowledgeBases)
    .where(
      and(eq(knowledgeBases.id, kbId), eq(knowledgeBases.userId, userId))
    );

  return kb;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; folderId: string }> }
) {
  try {
    const session = await requireSession();
    const { id, folderId } = await params;
    const body = await request.json();
    const data = renameFolderSchema.parse(body);

    const kb = await verifyKnowledgeBaseAccess(id, session.user.id);
    if (!kb) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [folder] = await db
      .update(folders)
      .set({ name: data.name, updatedAt: new Date() })
      .where(
        and(
          eq(folders.id, folderId),
          eq(folders.knowledgeBaseId, id)
        )
      )
      .returning();

    if (!folder) {
      return NextResponse.json(
        { error: "Folder not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(folder);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; folderId: string }> }
) {
  try {
    const session = await requireSession();
    const { id, folderId } = await params;

    const kb = await verifyKnowledgeBaseAccess(id, session.user.id);
    if (!kb) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const folderList = await db
      .select({ id: folders.id, parentFolderId: folders.parentFolderId })
      .from(folders)
      .where(eq(folders.knowledgeBaseId, id));

    if (!folderList.some((folder) => folder.id === folderId)) {
      return NextResponse.json(
        { error: "Folder not found" },
        { status: 404 }
      );
    }

    const childrenByParent = new Map<string, string[]>();
    for (const folder of folderList) {
      if (!folder.parentFolderId) continue;
      const children = childrenByParent.get(folder.parentFolderId) ?? [];
      children.push(folder.id);
      childrenByParent.set(folder.parentFolderId, children);
    }

    const stack = [folderId];
    const deletedFolderIdSet = new Set<string>();

    while (stack.length > 0) {
      const currentFolderId = stack.pop();
      if (!currentFolderId || deletedFolderIdSet.has(currentFolderId)) {
        continue;
      }

      deletedFolderIdSet.add(currentFolderId);
      for (const childId of childrenByParent.get(currentFolderId) ?? []) {
        stack.push(childId);
      }
    }

    const deletedFolderIds = Array.from(deletedFolderIdSet);

    const targetDocuments = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.knowledgeBaseId, id),
          inArray(documents.folderId, deletedFolderIds)
        )
      );

    for (const doc of targetDocuments) {
      await deleteDocumentResources({
        id: doc.id,
        knowledgeBaseId: doc.knowledgeBaseId,
        metadata: (doc.metadata as Record<string, unknown> | null) ?? null,
      });
    }

    if (targetDocuments.length > 0) {
      await db
        .delete(documents)
        .where(
          and(
            eq(documents.knowledgeBaseId, id),
            inArray(
              documents.id,
              targetDocuments.map((doc) => doc.id)
            )
          )
        );
    }

    await db
      .delete(folders)
      .where(
        and(
          eq(folders.knowledgeBaseId, id),
          inArray(folders.id, deletedFolderIds)
        )
      );

    return NextResponse.json({ success: true, deletedFolderIds });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
