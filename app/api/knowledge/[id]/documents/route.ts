import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, knowledgeBases } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-utils";
import { and, eq } from "drizzle-orm";

async function verifyKnowledgeBaseAccess(kbId: string, userId: string) {
  const [kb] = await db
    .select()
    .from(knowledgeBases)
    .where(
      and(eq(knowledgeBases.id, kbId), eq(knowledgeBases.userId, userId))
    );
  return kb;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const kb = await verifyKnowledgeBaseAccess(id, session.user.id);
    if (!kb) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const folderId = request.nextUrl.searchParams.get("folderId");

    let query = db
      .select()
      .from(documents)
      .where(eq(documents.knowledgeBaseId, id))
      .$dynamic();

    if (folderId) {
      query = query.where(
        and(
          eq(documents.knowledgeBaseId, id),
          eq(documents.folderId, folderId)
        )
      );
    }

    const docList = await query.orderBy(documents.createdAt);
    return NextResponse.json(docList);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
