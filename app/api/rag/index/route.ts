import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-utils";
import { indexDocument } from "@/lib/rag/indexer";
import { db } from "@/lib/db";
import { documents, knowledgeBases } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const { documentId } = await request.json();

    if (!documentId) {
      return NextResponse.json(
        { error: "Missing documentId" },
        { status: 400 }
      );
    }

    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    const [kb] = await db
      .select()
      .from(knowledgeBases)
      .where(
        and(
          eq(knowledgeBases.id, doc.knowledgeBaseId),
          eq(knowledgeBases.userId, session.user.id)
        )
      );

    if (!kb) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const result = await indexDocument(documentId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Indexing error:", error);
    return NextResponse.json(
      { error: "Indexing failed" },
      { status: 500 }
    );
  }
}
