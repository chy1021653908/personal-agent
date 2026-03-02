import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-utils";
import { and, eq, asc } from "drizzle-orm";
import { z } from "zod";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const [conversation] = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, id),
          eq(conversations.userId, session.user.id)
        )
      );

    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt));

    return NextResponse.json({ ...conversation, messages: msgs });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

const updateSchema = z.object({
  title: z.string().optional(),
  retrievalScope: z
    .enum(["knowledge_base", "folder", "document", "none"])
    .optional(),
  retrievalScopeId: z.string().optional(),
  knowledgeBaseId: z.string().uuid().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = updateSchema.parse(body);

    const [conversation] = await db
      .update(conversations)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(conversations.id, id),
          eq(conversations.userId, session.user.id)
        )
      )
      .returning();

    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(conversation);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const [conversation] = await db
      .delete(conversations)
      .where(
        and(
          eq(conversations.id, id),
          eq(conversations.userId, session.user.id)
        )
      )
      .returning();

    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
