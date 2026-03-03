"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatInput } from "@/components/chat/chat-input";
import { ScopeSelector } from "@/components/knowledge/scope-selector";
import { useConversations } from "@/hooks/use-conversations";
import { useKnowledgeBases } from "@/hooks/use-knowledge-base";
import type { Message as StoredMessage, Conversation } from "@/types";
import type { UIMessage } from "ai";
import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

export default function ChatDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const {
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

  const handleSend = (content: string, model?: string) => {
    if (model) {
      sendMessage(
        { text: content },
        {
          body: {
            model,
          },
        }
      );
    } else {
      sendMessage({ text: content });
    }
  };

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Chat</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        <ChatMessages
          messages={messages}
          storedMessages={conversationData?.messages}
          isLoading={isLoading}
        />
        <div className="px-4 pb-1 shrink-0">
          <div className="mx-auto max-w-3xl">
            <ScopeSelector
              knowledgeBases={knowledgeBases}
              selectedKbId={selectedKbId}
              onSelect={handleKbSelect}
            />
          </div>
        </div>
        <div className="shrink-0">
          <ChatInput onSend={handleSend} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
