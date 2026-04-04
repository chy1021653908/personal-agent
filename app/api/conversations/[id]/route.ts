import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { getSessionFromHeaders, requireSession } from "@/lib/auth-utils";
import { and, eq, asc } from "drizzle-orm";
import { jsonErrorResponse } from "@/lib/api/responses";
import { z } from "zod";

type StoredConversationMessageRow = {
  id: string;
  conversationId: string;
  role: string;
  parts: unknown[];
  createdAt: string | Date;
};

async function getConversationMessages(
  conversationId: string,
): Promise<StoredConversationMessageRow[]> {
  const rows = await db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      role: messages.role,
      parts: messages.parts,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt), asc(messages.id));

  return rows;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const requestHeaders = await headers();
    const { session } = await getSessionFromHeaders(requestHeaders);
    if (!session) {
      return jsonErrorResponse(401, "Unauthorized");
    }

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

    const msgs = await getConversationMessages(id);

    return NextResponse.json({ ...conversation, messages: msgs });
  } catch (error) {
    console.error("Failed to load conversation detail:", error);
    return jsonErrorResponse(500, "Failed to load conversation");
  }
}

const updateSchema = z.object({
  title: z.string().optional(),
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
  } catch (error) {
    console.error("Failed to update conversation:", error);
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
