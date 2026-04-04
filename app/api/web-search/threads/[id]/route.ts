import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { webSearchThreads } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-utils";
import { and, eq } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const [row] = await db
      .delete(webSearchThreads)
      .where(
        and(
          eq(webSearchThreads.id, id),
          eq(webSearchThreads.userId, session.user.id),
        ),
      )
      .returning();

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
