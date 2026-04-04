import { notFound } from "next/navigation";
import { ChatDetailPageClient } from "@/app/(main)/chat/[id]/chat-detail-page-client";
import {
  getConversationDetail,
  getUserKnowledgeBases,
} from "@/lib/server/app-data";

export default async function ChatDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [initialConversationData, initialKnowledgeBases] = await Promise.all([
    getConversationDetail(id),
    getUserKnowledgeBases(),
  ]);

  if (!initialConversationData) {
    notFound();
  }

  return (
    <ChatDetailPageClient
      conversationId={id}
      initialConversationData={initialConversationData}
      initialKnowledgeBases={initialKnowledgeBases}
    />
  );
}
