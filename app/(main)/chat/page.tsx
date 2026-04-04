import { ChatPageClient } from "@/app/(main)/chat/chat-page-client";
import { getUserKnowledgeBases } from "@/lib/server/app-data";

export default async function ChatPage() {
  const initialKnowledgeBases = await getUserKnowledgeBases();

  return <ChatPageClient initialKnowledgeBases={initialKnowledgeBases} />;
}
