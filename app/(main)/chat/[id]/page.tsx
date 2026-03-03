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
import type { Message as StreamMessage } from "@langchain/langgraph-sdk";
import { FetchStreamTransport, useStream } from "@langchain/langgraph-sdk/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type ChatState = {
  messages: StreamMessage[];
};

const DEFAULT_MODEL = "gpt-4o-mini";

export default function ChatDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const {
    updateConversation,
  } = useConversations();
  const { knowledgeBases } = useKnowledgeBases();
  const [conversationData, setConversationData] = useState<
    (Conversation & { messages: StoredMessage[] }) | null
  >(null);
  const hasAutoSentRef = useRef(false);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/conversations/${id}`);
      if (res.ok) {
        setConversationData(await res.json());
      }
    }
    load();
  }, [id]);

  const transport = useMemo(
    () =>
      new FetchStreamTransport<ChatState>({
        apiUrl: "/api/chat",
        async onRequest(_url, init) {
          const bodyText = typeof init.body === "string" ? init.body : "{}";
          let payload: Record<string, unknown> = {};
          try {
            payload = JSON.parse(bodyText) as Record<string, unknown>;
          } catch {
            payload = {};
          }
          return {
            ...init,
            body: JSON.stringify({
              ...payload,
              conversationId: id,
            }),
          };
        },
      }),
    [id]
  );

  const { messages, submit, isLoading, error } = useStream<ChatState>({
    transport,
    threadId: id,
    throttle: true,
  });

  useEffect(() => {
    if (error) {
      console.error("Stream error:", error);
    }
  }, [error]);

  const sendMessage = useCallback(
    async (content: string, model?: string) => {
      const text = content.trim();
      if (!text || isLoading) return;

      const selectedModel = model || DEFAULT_MODEL;
      const userMessage: StreamMessage = {
        id: crypto.randomUUID(),
        type: "human",
        content: text,
      };

      await submit(
        { messages: [userMessage] },
        {
          context: {
            model: selectedModel,
          },
          optimisticValues(prev) {
            const prevMessages = Array.isArray(prev.messages) ? prev.messages : [];
            return {
              ...prev,
              messages: [...prevMessages, userMessage],
            };
          },
        }
      );
    },
    [isLoading, submit]
  );
  const initialQuery = searchParams.get("q")?.trim() || "";

  useEffect(() => {
    if (!conversationData) return;
    if (!initialQuery || hasAutoSentRef.current) return;

    if (conversationData.messages.length > 0) {
      hasAutoSentRef.current = true;
      return;
    }

    hasAutoSentRef.current = true;
    void sendMessage(initialQuery, DEFAULT_MODEL);
  }, [conversationData, initialQuery, sendMessage]);

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
    void sendMessage(content, model);
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
