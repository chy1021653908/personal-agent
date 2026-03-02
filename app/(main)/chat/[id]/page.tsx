"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatInput } from "@/components/chat/chat-input";
import { ScopeSelector } from "@/components/knowledge/scope-selector";
import { useConversations } from "@/hooks/use-conversations";
import { useKnowledgeBases } from "@/hooks/use-knowledge-base";
import type { Message as StoredMessage, Conversation } from "@/types";
import type { UIMessage } from "ai";

export default function ChatDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const {
    conversations,
    createConversation,
    deleteConversation,
    updateConversation,
  } = useConversations();
  const { knowledgeBases } = useKnowledgeBases();
  const [conversationData, setConversationData] = useState<
    (Conversation & { messages: StoredMessage[] }) | null
  >(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/conversations/${id}`);
      if (res.ok) {
        setConversationData(await res.json());
      }
    }
    load();
  }, [id]);

  const initialMessages: UIMessage[] = useMemo(
    () =>
      conversationData?.messages
        ?.filter((m) => m.role !== "system")
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          parts: [{ type: "text" as const, text: m.content }],
        })) || [],
    [conversationData]
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { conversationId: id, provider: "openai" },
      }),
    [id]
  );

  const { messages, sendMessage, status } = useChat({
    id: `chat-${id}`,
    transport,
    messages: initialMessages,
  });

  const isLoading = status === "streaming" || status === "submitted";
  const selectedKbId = conversationData?.knowledgeBaseId || null;

  const handleKbSelect = async (kbId: string | null) => {
    await updateConversation(id, {
      knowledgeBaseId: kbId,
      retrievalScope: kbId ? "knowledge_base" : "none",
    });
    setConversationData((prev) =>
      prev
        ? {
            ...prev,
            knowledgeBaseId: kbId,
            retrievalScope: kbId ? "knowledge_base" : "none",
          }
        : null
    );
  };

  const handleSend = (content: string) => {
    sendMessage({ text: content });
  };

  return (
    <div className="flex h-full">
      <ChatSidebar
        conversations={conversations}
        onNewChat={async () => {
          const convo = await createConversation();
          router.push(`/chat/${convo.id}`);
        }}
        onDelete={async (convoId) => {
          await deleteConversation(convoId);
          if (convoId === id) router.push("/chat");
        }}
      />
      <div className="flex flex-1 flex-col">
        <ChatMessages
          messages={messages}
          storedMessages={conversationData?.messages}
          isLoading={isLoading}
        />
        <div className="px-4 pb-1">
          <div className="mx-auto max-w-3xl">
            <ScopeSelector
              knowledgeBases={knowledgeBases}
              selectedKbId={selectedKbId}
              onSelect={handleKbSelect}
            />
          </div>
        </div>
        <ChatInput onSend={handleSend} isLoading={isLoading} />
      </div>
    </div>
  );
}
