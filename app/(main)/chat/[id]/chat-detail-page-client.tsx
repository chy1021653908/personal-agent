"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { BreadcrumbItem, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatInput } from "@/components/chat/chat-input";
import { SourceReferencesSidePanel } from "@/components/source-references-sheet";
import { MainPageHeader } from "@/components/main-page-header";
import { useKnowledgeBases } from "@/hooks/use-knowledge-base";
import type { ChatUIMessage } from "@/lib/ai/chat-ui-message";
import type { ChatModelProvider } from "@/lib/ai/model-provider";
import { takeChatEntryRequest } from "@/lib/chat/entry-request";
import type { ConversationDetail } from "@/lib/server/app-data";
import type { KnowledgeBase, Source } from "@/types";
import { CHAT_MODELS } from "@/lib/ai/chat-models";

export function ChatDetailPageClient({
  conversationId,
  initialConversationData,
  initialKnowledgeBases,
}: {
  conversationId: string;
  initialConversationData: ConversationDetail;
  initialKnowledgeBases: KnowledgeBase[];
}) {
  const t = useTranslations();
  const { knowledgeBases } = useKnowledgeBases(initialKnowledgeBases);
  const [entryRequest] = useState(() => takeChatEntryRequest(conversationId));
  const initialQuery = entryRequest.query;
  const initialKbId = entryRequest.kbId;
  const initialModelId = entryRequest.modelId;
  const initialModelProvider = entryRequest.modelProvider;
  const [selectedKbId, setSelectedKbId] = useState<string | null>(
    initialKbId ?? initialConversationData.knowledgeBaseId ?? null,
  );
  const [referencePanel, setReferencePanel] = useState<{
    key: string;
    sources: Source[];
  } | null>(null);
  const hasAutoSentRef = useRef(false);

  const {
    messages: uiMessages,
    sendMessage,
    status,
    error,
  } = useChat<ChatUIMessage>({
    id: conversationId,
    messages: initialConversationData.messages as unknown as ChatUIMessage[],
    transport: useMemo(
      () =>
        new DefaultChatTransport({
          api: "/api/chat",
          prepareSendMessagesRequest: ({ body, messages }) => ({
            body: {
              ...body,
              messages: messages.slice(-1),
            },
          }),
        }),
      [],
    ),
    experimental_throttle: 30,
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!error) return;
    console.error("Chat stream error:", error);
  }, [error]);

  const send = useCallback(
    async (content: string, model: string, modelProvider: ChatModelProvider) => {
      const text = content.trim();
      if (!text || isLoading) return;

      await sendMessage(
        { text },
        {
          body: {
            conversationId,
            context: {
              model,
              modelProvider,
              knowledgeBaseId: selectedKbId ?? undefined,
              retrievalScope: selectedKbId ? "knowledge_base" : "none",
            },
          },
        },
      );
    },
    [conversationId, isLoading, selectedKbId, sendMessage],
  );

  useEffect(() => {
    if (!initialQuery || hasAutoSentRef.current) return;
    if (initialConversationData.messages.length > 0) {
      hasAutoSentRef.current = true;
      return;
    }

    hasAutoSentRef.current = true;
    const fallback = CHAT_MODELS[0];
    void send(
      initialQuery,
      initialModelId ?? fallback.id,
      initialModelProvider ?? fallback.modelProvider,
    );
  }, [
    initialConversationData.messages.length,
    initialModelId,
    initialModelProvider,
    initialQuery,
    send,
  ]);

  const handleSend = (
    content: string,
    model?: string,
    options?: { enableWebSearch?: boolean; modelProvider?: ChatModelProvider },
  ) => {
    const m = model?.trim();
    const p = options?.modelProvider;
    if (!m || !p) return;
    void send(content, m, p);
  };
  const handleToggleReferences = useCallback(
    (sources: Source[], key: string) => {
      setReferencePanel((prev) =>
        prev?.key === key ? null : { key, sources },
      );
    },
    [],
  );

  return (
    <div className="flex flex-1 h-full flex-col overflow-hidden">
      <MainPageHeader>
        <BreadcrumbItem>
          <BreadcrumbPage>{t("chat.breadcrumb")}</BreadcrumbPage>
        </BreadcrumbItem>
      </MainPageHeader>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ChatMessages
            messages={uiMessages}
            isLoading={isLoading}
            activeReferenceKey={referencePanel?.key ?? null}
            onToggleReferences={handleToggleReferences}
          />

          <div className="shrink-0">
            <ChatInput
              onSend={handleSend}
              isLoading={isLoading}
              knowledgeBases={knowledgeBases}
              selectedKbId={selectedKbId}
              onSelectKnowledgeBase={setSelectedKbId}
              showWebSearchToggle={false}
              initialModelId={initialModelId ?? undefined}
            />
          </div>
        </div>
        <SourceReferencesSidePanel
          open={Boolean(referencePanel)}
          sources={referencePanel?.sources ?? []}
          onClose={() => setReferencePanel(null)}
        />
      </div>
    </div>
  );
}
