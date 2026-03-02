import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { knowledgeBases } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-utils";
import { eq } from "drizzle-orm";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

export async function GET() {
  try {
    const session = await requireSession();
    const kbs = await db
      .select()
      .from(knowledgeBases)
      .where(eq(knowledgeBases.userId, session.user.id))
      .orderBy(knowledgeBases.createdAt);
    return NextResponse.json(kbs);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const data = createSchema.parse(body);

    const [kb] = await db
      .insert(knowledgeBases)
      .values({
        userId: session.user.id,
        name: data.name,
        description: data.description,
      })
      .returning();

    return NextResponse.json(kb, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
