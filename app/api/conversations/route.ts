import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-utils";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().optional(),
});

export async function GET() {
  try {
    const session = await requireSession();
    const convos = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, session.user.id))
      .orderBy(desc(conversations.updatedAt));
    return NextResponse.json(convos);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const data = createSchema.parse(body);

    const [conversation] = await db
      .insert(conversations)
      .values({
        userId: session.user.id,
        title: data.title || "新对话",
      })
      .returning();

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
