import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, knowledgeBases } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-utils";
import { and, eq } from "drizzle-orm";
import { deleteFile } from "@/lib/supabase/storage";

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

    const [doc] = await db
      .delete(documents)
      .where(
        and(
          eq(documents.id, docId),
          eq(documents.knowledgeBaseId, id)
        )
      )
      .returning();

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    if (doc.metadata && typeof doc.metadata === "object") {
      const storagePath = (doc.metadata as Record<string, string>).storagePath;
      if (storagePath) {
        try {
          await deleteFile(storagePath);
        } catch {
          console.error("Failed to delete file from storage");
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
