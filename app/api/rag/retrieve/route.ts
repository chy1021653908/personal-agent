import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-utils";
import { retrieve } from "@/lib/rag/retriever";
import { db } from "@/lib/db";
import { knowledgeBases } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const retrieveSchema = z.object({
  knowledgeBaseId: z.string().uuid(),
  query: z.string().min(1),
  topK: z.number().min(1).max(20).optional(),
  scope: z.enum(["knowledge_base", "folder", "document"]).optional(),
  scopeId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const data = retrieveSchema.parse(body);

    const [kb] = await db
      .select()
      .from(knowledgeBases)
      .where(
        and(
          eq(knowledgeBases.id, data.knowledgeBaseId),
          eq(knowledgeBases.userId, session.user.id)
        )
      );

    if (!kb) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const results = await retrieve({
      knowledgeBaseId: data.knowledgeBaseId,
      query: data.query,
      topK: data.topK,
      scope: data.scope,
      scopeId: data.scopeId,
    });

    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("Retrieve error:", error);
    return NextResponse.json(
      { error: "Retrieval failed" },
      { status: 500 }
    );
  }
}
