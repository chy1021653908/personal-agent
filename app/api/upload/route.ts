import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, knowledgeBases } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-utils";
import { uploadFile } from "@/lib/supabase/storage";
import { and, eq } from "drizzle-orm";

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const knowledgeBaseId = formData.get("knowledgeBaseId") as string | null;
    const folderId = (formData.get("folderId") as string) || null;

    if (!file || !knowledgeBaseId) {
      return NextResponse.json(
        { error: "Missing file or knowledgeBaseId" },
        { status: 400 }
      );
    }

    const [kb] = await db
      .select()
      .from(knowledgeBases)
      .where(
        and(
          eq(knowledgeBases.id, knowledgeBaseId),
          eq(knowledgeBases.userId, session.user.id)
        )
      );

    if (!kb) {
      return NextResponse.json(
        { error: "Knowledge base not found" },
        { status: 404 }
      );
    }

    const fileType =
      ALLOWED_TYPES[file.type] ||
      file.name.split(".").pop()?.toLowerCase() ||
      "unknown";

    const { url, path } = await uploadFile(
      session.user.id,
      knowledgeBaseId,
      file
    );

    const [doc] = await db
      .insert(documents)
      .values({
        knowledgeBaseId,
        folderId,
        name: file.name,
        fileType,
        fileUrl: url,
        fileSize: file.size,
        status: "pending",
        metadata: { storagePath: path },
      })
      .returning();

    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
