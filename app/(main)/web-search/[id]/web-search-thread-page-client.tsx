"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Message as StreamMessage } from "@langchain/langgraph-sdk";
import { FetchStreamTransport, useStream } from "@langchain/react";
import { BreadcrumbItem, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { ChatInput } from "@/components/chat/chat-input";
import { MainPageHeader } from "@/components/main-page-header";
import { SourceReferencesSidePanel } from "@/components/source-references-sheet";
import { WebSearchChatMessages } from "@/components/web-search/web-search-chat-messages";
import type { StreamCompatibleMessage } from "@/lib/ai/langgraph-stream-message-guards";
import type { ChatModelProvider } from "@/lib/ai/model-provider";
import { isStreamAIMessage } from "@/lib/ai/langgraph-stream-message-guards";
import type { WebSearchWorkflowRoot } from "@/lib/ai/web-search-workflow-state";
import {
  parseWebSearchSourcesCustomPayload,
  parseWebSearchWorkflowCustomPayload,
} from "@/lib/web-search/parse-workflow-payload";
import { useWebSearchThreads } from "@/hooks/use-web-search-threads";
import type { Source } from "@/types";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

type ThreadState = {
  messages: StreamCompatibleMessage[];
};

export function WebSearchThreadPageClient({
  threadId,
  initialMessages,
  initialModelId,
  initialModelProvider,
}: {
  threadId: string;
  initialMessages: StreamCompatibleMessage[];
  initialModelId: string;
  initialModelProvider: ChatModelProvider;
}) {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const { upsertThread } = useWebSearchThreads();
  const [workflow, setWorkflow] = useState<WebSearchWorkflowRoot | null>(null);
  const [workflowByMessageId, setWorkflowByMessageId] = useState<
    Record<string, WebSearchWorkflowRoot>
  >({});
  const [sources, setSources] = useState<Source[] | null>(null);
  const [sourcesByMessageId, setSourcesByMessageId] = useState<
    Record<string, Source[]>
  >({});
  const [referencePanel, setReferencePanel] = useState<{
    key: string;
    sources: Source[];
  } | null>(null);
  const messagesRef = useRef<StreamCompatibleMessage[]>(initialMessages);
  const hasAutoSentRef = useRef(false);

  const transport = useMemo(
    () =>
      new FetchStreamTransport<ThreadState>({
        apiUrl: "/api/web-search",
      }),
    [],
  );

  const stream = useStream<ThreadState>({
    transport,
    threadId,
    throttle: true,
    initialValues: { messages: initialMessages },
    onCustomEvent(data) {
      const nextSources = parseWebSearchSourcesCustomPayload(data);
      if (nextSources) {
        setSources(nextSources);
        return;
      }
      const next = parseWebSearchWorkflowCustomPayload(data);
      if (next) {
        setWorkflow(next);
      }
    },
  });

  const { messages, submit, isLoading, error } = stream;
  const liveMessages = Array.isArray(messages) ? messages : [];
  const displayMessages =
    liveMessages.length > 0 || isLoading ? liveMessages : initialMessages;

  useEffect(() => {
    messagesRef.current = displayMessages;
  }, [displayMessages]);

  useEffect(() => {
    if (error) {
      console.error("Web search stream error:", error);
    }
  }, [error]);

  const sendMessage = useCallback(
    async (
      content: string,
      model?: string,
      options?: {
        enableWebSearch?: boolean;
        modelProvider?: ChatModelProvider;
      },
    ) => {
      const text = content.trim();
      if (!text || isLoading) return;

      const enableWebSearch = options?.enableWebSearch ?? false;
      const modelProvider = options?.modelProvider;
      const trimmedModel = model?.trim();
      if (!trimmedModel || !modelProvider) return;

      await upsertThread(threadId);

      const lastAiId = (() => {
        const list = messagesRef.current;
        for (let i = list.length - 1; i >= 0; i--) {
          const message = list[i];
          if (message && isStreamAIMessage(message) && message.id != null) {
            return String(message.id);
          }
        }
        return undefined;
      })();

      setWorkflowByMessageId((prev) => {
        if (!lastAiId || !workflow) return prev;
        return { ...prev, [lastAiId]: workflow };
      });
      setSourcesByMessageId((prev) => {
        if (!lastAiId || !sources) return prev;
        return { ...prev, [lastAiId]: sources };
      });
      setWorkflow(null);
      setSources(null);

      const userMessage: StreamMessage = {
        id: crypto.randomUUID(),
        type: "human",
        content: text,
      };

      await submit(
        { messages: [userMessage] },
        {
          context: {
            model: trimmedModel,
            modelProvider,
            enableWebSearch,
          },
          optimisticValues(prev) {
            const fromPrev = Array.isArray(prev.messages) ? prev.messages : [];
            const fromStream = messagesRef.current;
            const prevMessages =
              fromStream.length >= fromPrev.length ? fromStream : fromPrev;

            return {
              ...prev,
              messages: [...prevMessages, userMessage],
            };
          },
        },
      );
    },
    [isLoading, sources, submit, threadId, upsertThread, workflow],
  );

  const initialQuery = searchParams.get("q")?.trim() ?? "";
  const initialEnableWebSearch =
    searchParams.get("ws") === "1" || searchParams.get("ws") === "true";

  useEffect(() => {
    if (!initialQuery || hasAutoSentRef.current) return;
    if (displayMessages.length > 0) {
      hasAutoSentRef.current = true;
      return;
    }

    hasAutoSentRef.current = true;
    const id = requestAnimationFrame(() => {
      void sendMessage(initialQuery, initialModelId, {
        modelProvider: initialModelProvider,
        enableWebSearch: initialEnableWebSearch,
      });
    });

    return () => cancelAnimationFrame(id);
  }, [
    displayMessages.length,
    initialEnableWebSearch,
    initialModelId,
    initialModelProvider,
    initialQuery,
    sendMessage,
  ]);

  const handleSend = (
    content: string,
    model?: string,
    options?: { enableWebSearch?: boolean; modelProvider?: ChatModelProvider },
  ) => {
    void sendMessage(content, model, options);
  };
  const handleToggleReferences = useCallback(
    (nextSources: Source[], key: string) => {
      setReferencePanel((prev) =>
        prev?.key === key ? null : { key, sources: nextSources },
      );
    },
    [],
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <MainPageHeader>
        <BreadcrumbItem>
          <BreadcrumbPage>{t("webSearch.breadcrumb")}</BreadcrumbPage>
        </BreadcrumbItem>
      </MainPageHeader>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <WebSearchChatMessages
            messages={displayMessages}
            workflow={workflow}
            workflowByMessageId={workflowByMessageId}
            sources={sources}
            sourcesByMessageId={sourcesByMessageId}
            isLoading={isLoading}
            activeReferenceKey={referencePanel?.key ?? null}
            onToggleReferences={handleToggleReferences}
          />
          <div className="shrink-0 border-t bg-background">
            <ChatInput
              onSend={handleSend}
              isLoading={isLoading}
              knowledgeBases={[]}
              selectedKbId={null}
              onSelectKnowledgeBase={() => {}}
              placeholder={t("webSearch.threadPlaceholder")}
              showKnowledgeBase={false}
              showWebSearchToggle
              initialUseWebSearch={initialEnableWebSearch}
              initialModelId={initialModelId}
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
