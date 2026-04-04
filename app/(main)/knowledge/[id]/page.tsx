import { notFound } from "next/navigation";
import { KnowledgeBaseDetailPageClient } from "@/app/(main)/knowledge/[id]/knowledge-base-detail-page-client";
import {
  getKnowledgeBaseDetail,
  getUserKnowledgeBases,
} from "@/lib/server/app-data";

export default async function KnowledgeBaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [initialKnowledgeBases, detail] = await Promise.all([
    getUserKnowledgeBases(),
    getKnowledgeBaseDetail(id),
  ]);

  if (!detail) {
    notFound();
  }

  return (
    <KnowledgeBaseDetailPageClient
      knowledgeBaseId={id}
      initialKnowledgeBases={initialKnowledgeBases}
      initialFolders={detail.folders}
      initialDocuments={detail.documents}
    />
  );
}
