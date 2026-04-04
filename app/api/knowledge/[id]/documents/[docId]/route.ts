import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, knowledgeBases } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-utils";
import { and, eq } from "drizzle-orm";
import { deleteDocumentResources } from "@/lib/rag/document-cleanup";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const session = await requireSession();
    const { id, docId } = await params;

    const [kb] = await db
      .select()
      .from(knowledgeBases)
      .where(
        and(
          eq(knowledgeBases.id, id),
          eq(knowledgeBases.userId, session.user.id)
        )
      );

    if (!kb) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [targetDoc] = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.id, docId),
          eq(documents.knowledgeBaseId, id)
        )
      );

    if (!targetDoc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    await deleteDocumentResources({
      id: targetDoc.id,
      knowledgeBaseId: targetDoc.knowledgeBaseId,
      metadata: (targetDoc.metadata as Record<string, unknown> | null) ?? null,
    });

    const [deletedDoc] = await db
      .delete(documents)
      .where(
        and(
          eq(documents.id, docId),
          eq(documents.knowledgeBaseId, id)
        )
      )
      .returning();

    if (!deletedDoc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
