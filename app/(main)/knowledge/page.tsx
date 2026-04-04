import { KnowledgePageClient } from "@/app/(main)/knowledge/knowledge-page-client";
import { getUserKnowledgeBases } from "@/lib/server/app-data";

export default async function KnowledgePage() {
  const initialKnowledgeBases = await getUserKnowledgeBases();

  return <KnowledgePageClient initialKnowledgeBases={initialKnowledgeBases} />;
}
