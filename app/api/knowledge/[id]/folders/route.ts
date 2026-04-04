import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { folders, knowledgeBases } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-utils";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const createFolderSchema = z.object({
  name: z.string().min(1).max(100),
  parentFolderId: z.string().uuid().optional(),
});

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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const kb = await verifyKnowledgeBaseAccess(id, session.user.id);
    if (!kb) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const folderList = await db
      .select()
      .from(folders)
      .where(eq(folders.knowledgeBaseId, id))
      .orderBy(folders.name);

    return NextResponse.json(folderList);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = createFolderSchema.parse(body);

    const kb = await verifyKnowledgeBaseAccess(id, session.user.id);
    if (!kb) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [folder] = await db
      .insert(folders)
      .values({
        knowledgeBaseId: id,
        name: data.name,
        parentFolderId: data.parentFolderId,
      })
      .returning();

    return NextResponse.json(folder, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
