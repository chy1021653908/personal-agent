"use client";

import { useRouter } from "next/navigation";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatInput } from "@/components/chat/chat-input";
import { ScopeSelector } from "@/components/knowledge/scope-selector";
import { useConversations } from "@/hooks/use-conversations";
import { useKnowledgeBases } from "@/hooks/use-knowledge-base";
import { useState } from "react";

export default function ChatPage() {
  const router = useRouter();
  const {
    conversations,
    createConversation,
    deleteConversation,
  } = useConversations();
  const { knowledgeBases } = useKnowledgeBases();
  const [selectedKbId, setSelectedKbId] = useState<string | null>(null);

  const handleNewChat = async () => {
    const convo = await createConversation(
      undefined,
      selectedKbId || undefined
    );
    router.push(`/chat/${convo.id}`);
  };

  const handleSend = async (content: string, _model?: string) => {
    const convo = await createConversation(
      content.slice(0, 50),
      selectedKbId || undefined
    );
    router.push(`/chat/${convo.id}?q=${encodeURIComponent(content)}`);
  };

  return (
    <div className="flex h-full">
      <ChatSidebar
        conversations={conversations}
        onNewChat={handleNewChat}
        onDelete={async (id) => {
          await deleteConversation(id);
        }}
      />
      <div className="flex flex-1 flex-col">
        <ChatMessages messages={[]} isLoading={false} />
        <div className="px-4 pb-1">
          <div className="mx-auto max-w-3xl">
            <ScopeSelector
              knowledgeBases={knowledgeBases}
              selectedKbId={selectedKbId}
              onSelect={setSelectedKbId}
            />
          </div>
        </div>
        <ChatInput onSend={handleSend} isLoading={false} />
      </div>
    </div>
  );
}
