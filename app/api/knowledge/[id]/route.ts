import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { knowledgeBases } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-utils";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;

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

    return NextResponse.json(kb);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = updateSchema.parse(body);

    const [kb] = await db
      .update(knowledgeBases)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(knowledgeBases.id, id),
          eq(knowledgeBases.userId, session.user.id)
        )
      )
      .returning();

    if (!kb) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(kb);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
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

    const [kb] = await db
      .delete(knowledgeBases)
      .where(
        and(
          eq(knowledgeBases.id, id),
          eq(knowledgeBases.userId, session.user.id)
        )
      )
      .returning();

    if (!kb) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
