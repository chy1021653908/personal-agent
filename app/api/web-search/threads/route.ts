import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { webSearchThreads } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-utils";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

const upsertSchema = z.object({
  id: z.string().uuid(),
  title: z.string().optional(),
});

export async function GET() {
  try {
    const session = await requireSession();
    const rows = await db
      .select()
      .from(webSearchThreads)
      .where(eq(webSearchThreads.userId, session.user.id))
      .orderBy(desc(webSearchThreads.updatedAt));
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/** 创建或更新当前用户的检索 thread 元数据（id 与 LangGraph thread_id 一致） */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const data = upsertSchema.parse(body);

    const [existing] = await db
      .select()
      .from(webSearchThreads)
      .where(eq(webSearchThreads.id, data.id));

    if (existing) {
      if (existing.userId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const titlePatch =
        data.title !== undefined && data.title.trim() !== ""
          ? { title: data.title.trim() }
          : {};
      const [row] = await db
        .update(webSearchThreads)
        .set({
          ...titlePatch,
          updatedAt: new Date(),
        })
        .where(eq(webSearchThreads.id, data.id))
        .returning();
      return NextResponse.json(row);
    }

    const [row] = await db
      .insert(webSearchThreads)
      .values({
        id: data.id,
        userId: session.user.id,
        title: data.title?.trim() || "工作流检索",
      })
      .returning();

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
