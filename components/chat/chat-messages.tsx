"use client";

import {
  CheckCircle2,
  CheckIcon,
  CopyIcon,
  Loader,
  SearchIcon,
} from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  PendingApprovalCard,
  type HitlApproval,
} from "@/components/chat/pending-approval-card";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
  MessageToolbar,
} from "@/components/ai-elements/message";
import {
  WeatherWidget,
  type WeatherWidgetProps,
} from "@/components/tool-ui/weather-widget/runtime";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  buildSourceSelectionKey,
  SourceReferencesSheet,
} from "@/components/source-references-sheet";
import {
  getUrlDomain,
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselItem,
  InlineCitationSource,
} from "@/components/ai-elements/inline-citation";
import {
  type ChatMessagePart,
  dedupeSources,
  dedupeSourcesByDocumentId,
  dedupeStoredToolSourcesByTitle,
  getStoredToolPayloadSources,
  getStoredToolPayloadText,
  parseStoredToolPayload,
} from "@/lib/ai/chat-ui-message";
import { renderCitationTags } from "@/lib/ai/inline-citation-tags";
import { getSourceLink, toSource } from "@/lib/ai/source";
import type { ChatUIMessage } from "@/lib/ai/chat-ui-message";
import type { StoredToolSource } from "@/lib/db/schema";
import {
  safeParseWeatherWidgetPayload,
  type WeatherWidgetPayload,
} from "@/lib/weather/schema";
import type { Source } from "@/types";

interface ChatMessagesProps {
  messages: ChatUIMessage[];
  isLoading: boolean;
  isInitialLoading?: boolean;
  activeReferenceKey?: string | null;
  onToggleReferences?: (sources: Source[], key: string) => void;
  pendingApprovals?: HitlApproval[];
  approvalProcessingIds?: number[];
  onApproveApproval?: (
    index: number,
    editedArgs?: Record<string, unknown>,
  ) => void;
  onRejectApproval?: (index: number, reason?: string) => void;
}

type ToolStepView = {
  key: string;
  name?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  status: "active" | "complete";
  sources?: StoredToolSource[];
};

type TextItem = {
  id: string;
  kind: "text";
  from: "user" | "assistant";
  text: string;
  isStreaming?: boolean;
  sources?: Source[] | null;
  references?: Source[];
};

type ReasoningItem = {
  id: string;
  kind: "reasoning";
  text: string;
  isStreaming: boolean;
};

type SearchToolItem = {
  id: string;
  kind: "search-tool";
  toolStep: ToolStepView;
};

type WeatherToolItem = {
  id: string;
  kind: "weather-tool";
  payload: WeatherWidgetPayload;
};

type ToolStatusItem = {
  id: string;
  kind: "tool-status";
  toolStep: ToolStepView;
};

type TypingItem = {
  id: string;
  kind: "typing";
};

type RenderItem =
  | TextItem
  | ReasoningItem
  | SearchToolItem
  | WeatherToolItem
  | ToolStatusItem
  | TypingItem;

type MessageSourceContext = {
  citedSources: Source[];
  sources: Source[] | null;
};

const SEARCH_TOOL_NAMES = new Set(["web_search", "search_knowledge_base"]);
const WEATHER_TOOL_NAMES = new Set(["get_weather"]);

function isSearchToolName(toolName: string | undefined): boolean {
  return Boolean(toolName && SEARCH_TOOL_NAMES.has(toolName));
}

function isWeatherToolName(toolName: string | undefined): boolean {
  return Boolean(toolName && WEATHER_TOOL_NAMES.has(toolName));
}

function collectSourceContext(parts: ChatMessagePart[]): MessageSourceContext {
  const rawSources: Source[] = [];

  for (const part of parts) {
    if (part.type !== "data-source-url") continue;

    for (const item of part.data.sources) {
      const source = toSource(item);
      if (source) {
        rawSources.push(source);
      }
    }
  }

  const sources = rawSources.length > 0 ? dedupeSources(rawSources) : null;

  return {
    sources,
    citedSources: dedupeSourcesByDocumentId(sources),
  };
}

function getSourceAvatarText(
  fileName: string | undefined,
  fallback: string,
): string {
  const base = (fileName || "").trim();
  if (!base) return fallback;

  const withoutExt = base.replace(/\.[^/.]+$/, "");
  const cleaned = withoutExt.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "");
  if (!cleaned) return fallback;

  return cleaned.slice(0, 1).toUpperCase();
}

function getMessageText(parts: ChatMessagePart[]): string {
  const chunks: string[] = [];

  for (const part of parts) {
    if (part.type === "text" && part.text.trim()) {
      chunks.push(part.text.trim());
    }
  }

  return chunks.join("\n").trim();
}

function parseWeatherToolPayload(raw: unknown): WeatherWidgetPayload | null {
  const parsed = parseStoredToolPayload(raw);
  return parsed ? safeParseWeatherWidgetPayload(parsed) : null;
}

function buildToolStep(
  part: Extract<ChatMessagePart, { type: "dynamic-tool" }>,
): ToolStepView {
  const status = part.state.startsWith("input") ? "active" : "complete";

  return {
    key: part.toolCallId,
    name: part.toolName,
    input: part.input,
    output: part.output,
    errorText: "errorText" in part ? part.errorText : undefined,
    status,
    sources: isSearchToolName(part.toolName)
      ? dedupeStoredToolSourcesByTitle(getStoredToolPayloadSources(part.output))
      : undefined,
  };
}

function attachReferences(
  items: RenderItem[],
  references: Source[],
  isStreaming: boolean,
) {
  if (references.length === 0 || isStreaming) return items;

  const lastTextIndex = items.findLastIndex(
    (item) => item.kind === "text" && item.from === "assistant",
  );

  if (lastTextIndex < 0) return items;

  const nextItems = [...items];
  const textItem = nextItems[lastTextIndex] as TextItem;
  nextItems[lastTextIndex] = {
    ...textItem,
    references,
  };
  return nextItems;
}

function buildAssistantItems(params: {
  messageId: string;
  parts: ChatMessagePart[];
  isStreaming: boolean;
}): RenderItem[] {
  const { messageId, parts, isStreaming } = params;
  const textContent = getMessageText(parts);
  const reasoningStreaming = isStreaming && !textContent;
  const sourceContext = collectSourceContext(parts);
  const items: RenderItem[] = [];

  for (const [partIndex, part] of parts.entries()) {
    if (part.type === "text" && part.text.trim()) {
      items.push({
        id: `${messageId}-text-${partIndex}`,
        kind: "text",
        from: "assistant",
        text: part.text,
        isStreaming:
          "state" in part && part.state === "streaming" && isStreaming,
        sources: sourceContext.sources,
      });
      continue;
    }

    if (part.type === "reasoning" && part.text.trim()) {
      items.push({
        id: `${messageId}-reasoning-${partIndex}`,
        kind: "reasoning",
        text: part.text.trim(),
        isStreaming: reasoningStreaming,
      });
      continue;
    }

    if (part.type !== "dynamic-tool" || part.state === "input-streaming") {
      continue;
    }

    const toolStep = buildToolStep(part);

    if (isSearchToolName(part.toolName)) {
      items.push({
        id: `${messageId}-search-${part.toolCallId}`,
        kind: "search-tool",
        toolStep,
      });
      continue;
    }

    if (isWeatherToolName(part.toolName) && part.state === "output-available") {
      const payload = parseWeatherToolPayload(part.output);

      if (payload) {
        items.push({
          id: `${messageId}-weather-${part.toolCallId}`,
          kind: "weather-tool",
          payload,
        });
        continue;
      }
    }

    items.push({
      id: `${messageId}-tool-${part.toolCallId}`,
      kind: "tool-status",
      toolStep,
    });
  }

  return attachReferences(items, sourceContext.citedSources, isStreaming);
}

function buildRenderItems(
  messages: ChatUIMessage[],
  isLoading: boolean,
): RenderItem[] {
  const items: RenderItem[] = [];

  for (const [messageIndex, message] of messages.entries()) {
    const messageId =
      typeof message.id === "string" ? message.id : `message-${messageIndex}`;
    const isLastMessage = messageIndex === messages.length - 1;
    const parts = message.parts as ChatMessagePart[];

    if (message.role === "user") {
      const text = getMessageText(parts);

      if (text) {
        items.push({
          id: `${messageId}-user`,
          kind: "text",
          from: "user",
          text,
        });
      }

      if (isLastMessage && isLoading) {
        items.push({
          id: `${messageId}-typing`,
          kind: "typing",
        });
      }

      continue;
    }

    if (message.role !== "assistant") {
      continue;
    }

    items.push(
      ...buildAssistantItems({
        messageId,
        parts,
        isStreaming: isLastMessage && isLoading,
      }),
    );
  }

  return items;
}

function renderInlineCitationResponse(
  text: string,
  isStreaming: boolean,
  sources: Source[] | null | undefined,
  t: ReturnType<typeof useTranslations>,
) {
  const sourceByIndex = new Map<number, Source>();

  dedupeSources(sources).forEach((source, index) => {
    const sourceIndex =
      typeof source.index === "number" && Number.isInteger(source.index)
        ? source.index
        : index + 1;
    sourceByIndex.set(sourceIndex, source);
  });

  const processedText =
    sources && sources.length > 0 ? renderCitationTags(text) : text;

  return (
    <MessageResponse
      mode="streaming"
      animated={false}
      isAnimating={isStreaming}
      caret={isStreaming ? "circle" : undefined}
      allowedTags={{ citation: ["source"] }}
      components={{
        citation: (props: Record<string, unknown>) => {
          const index = Number(props.source);
          const source = Number.isInteger(index)
            ? sourceByIndex.get(index)
            : undefined;

          if (!source) {
            return (
              <span className="text-xs text-muted-foreground">[{index}]</span>
            );
          }

          const triggerLabel =
            source.source === "knowledge_base"
              ? source.fileName || t("chat.messages.sourceLabel", { index })
              : getUrlDomain(getSourceLink(source) ?? source.documentId) ||
                source.fileName ||
                t("chat.messages.sourceLabel", { index });

          return (
            <InlineCitation>
              <InlineCitationCard>
                <InlineCitationCardTrigger
                  sources={[triggerLabel]}
                  className="h-5 rounded-md px-1.5 text-[11px]"
                />
                <InlineCitationCardBody>
                  <InlineCitationCarousel>
                    <InlineCitationCarouselContent>
                      <InlineCitationCarouselItem>
                        <InlineCitationSource
                          title={
                            source.fileName ||
                            t("chat.messages.sourceLabel", { index })
                          }
                          url={getSourceLink(source)}
                          description={source.content || undefined}
                        />
                      </InlineCitationCarouselItem>
                    </InlineCitationCarouselContent>
                  </InlineCitationCarousel>
                </InlineCitationCardBody>
              </InlineCitationCard>
            </InlineCitation>
          );
        },
      }}
    >
      {processedText}
    </MessageResponse>
  );
}

function getToolStepLabel(
  toolStep: ToolStepView,
  t: ReturnType<typeof useTranslations>,
): string {
  return (
    getStoredToolPayloadText(toolStep.input, [
      "summary",
      "query",
      "prompt",
      "message",
      "text",
      "command",
    ]) ||
    toolStep.name ||
    t("chat.messages.toolCall")
  );
}

function getToolStepQuery(toolStep: ToolStepView): string | undefined {
  return getStoredToolPayloadText(toolStep.input, [
    "query",
    "prompt",
    "message",
    "text",
    "command",
  ]);
}

function SearchToolStep({
  toolStep,
  t,
}: {
  toolStep: ToolStepView;
  t: ReturnType<typeof useTranslations>;
}) {
  const label = getToolStepLabel(toolStep, t);
  const query = getToolStepQuery(toolStep);
  const [isOpen, setIsOpen] = useState(toolStep.status === "active");
  const open = toolStep.status === "active" ? true : isOpen;

  useEffect(() => {
    if (toolStep.status === "active") return;

    const timer = setTimeout(() => {
      setIsOpen(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [toolStep.status]);

  return (
    <ChainOfThought
      open={open}
      onOpenChange={(nextOpen) => {
        if (toolStep.status !== "active") {
          setIsOpen(nextOpen);
        }
      }}
    >
      <ChainOfThoughtHeader>
        {toolStep.status === "active"
          ? t("chat.messages.retrievalInProgress")
          : t("chat.messages.retrievalDone")}
      </ChainOfThoughtHeader>
      <ChainOfThoughtContent>
        <ChainOfThoughtStep
          icon={SearchIcon}
          status={toolStep.status === "active" ? "active" : "complete"}
          label={label}
        >
          {query ? (
            <div className="flex flex-col gap-2">
              <ChainOfThoughtSearchResults>
                <ChainOfThoughtSearchResult>
                  <SearchIcon className="size-3" />
                  <span className="max-w-md truncate">{query}</span>
                </ChainOfThoughtSearchResult>
              </ChainOfThoughtSearchResults>
            </div>
          ) : null}
          {toolStep.sources?.length ? (
            <div className="max-h-60 overflow-y-auto rounded-md border bg-background">
              {toolStep.sources.map((source, index) => {
                const rowClass =
                  "flex items-center justify-between gap-3 border-b px-3 py-2 text-xs last:border-b-0";

                return source.url ? (
                  <a
                    key={`${source.title}-${index}`}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${rowClass} hover:bg-muted/60`}
                  >
                    <span className="truncate text-foreground">
                      {source.title}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {source.domain || t("common.source")}
                    </span>
                  </a>
                ) : (
                  <div key={`${source.title}-${index}`} className={rowClass}>
                    <span className="truncate text-foreground">
                      {source.title}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {source.domain || t("common.source")}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </ChainOfThoughtStep>
        {toolStep.status === "complete" ? (
          <ChainOfThoughtStep
            icon={CheckCircle2}
            label={t("common.complete")}
          />
        ) : null}
      </ChainOfThoughtContent>
    </ChainOfThought>
  );
}

function ToolStatus({
  toolStep,
  t,
}: {
  toolStep: ToolStepView;
  t: ReturnType<typeof useTranslations>;
}) {
  const summary =
    toolStep.errorText ||
    getStoredToolPayloadText(toolStep.output, ["error", "message"]) ||
    getToolStepQuery(toolStep) ||
    getToolStepLabel(toolStep, t);

  return (
    <Message from="assistant">
      <MessageContent>
        <p className="text-xs text-muted-foreground">
          {toolStep.name || t("chat.messages.toolCall")} · {summary} ·{" "}
          {toolStep.status === "active"
            ? t("common.loading")
            : t("common.complete")}
        </p>
      </MessageContent>
    </Message>
  );
}

function renderReasoningItem(
  item: ReasoningItem,
  t: ReturnType<typeof useTranslations>,
) {
  return (
    <Reasoning isStreaming={item.isStreaming} defaultOpen={item.isStreaming}>
      <ReasoningTrigger />
      <ReasoningContent>{item.text}</ReasoningContent>
    </Reasoning>
  );
}

function renderTypingIndicator(t: ReturnType<typeof useTranslations>) {
  return (
    <Message from="assistant">
      <MessageContent className="pt-1">
        <div
          className="inline-flex items-center gap-1 text-muted-foreground"
          aria-label={t("chat.messages.typingAria")}
        >
          <span
            className="h-2 w-2 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-muted-foreground/60"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="h-2 w-2 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-muted-foreground/60"
            style={{ animationDelay: "200ms" }}
          />
          <span
            className="h-2 w-2 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-muted-foreground/60"
            style={{ animationDelay: "400ms" }}
          />
        </div>
      </MessageContent>
    </Message>
  );
}

function renderEmptyState(t: ReturnType<typeof useTranslations>) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col gap-4 text-center">
        <h2 className="text-balance text-4xl font-semibold text-accent-foreground">
          {t("chat.messages.emptyStateTitle")}
        </h2>
      </div>
    </div>
  );
}

const CopyMessageAction = memo(function CopyMessageAction({
  content,
  label,
}: {
  content: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [content]);

  return (
    <MessageAction
      className="text-muted-foreground hover:text-muted-foreground hover:bg-source-references-hover"
      label={label}
      onClick={() => void handleCopy()}
      tooltip={label}
    >
      {copied ? (
        <CheckIcon className="size-4" />
      ) : (
        <CopyIcon className="size-4" />
      )}
    </MessageAction>
  );
});

function renderItem(
  item: RenderItem,
  options: {
    t: ReturnType<typeof useTranslations>;
    activeReferenceKey?: string | null;
    onToggleReferences?: (sources: Source[], key: string) => void;
  },
) {
  const { t, activeReferenceKey, onToggleReferences } = options;

  if (item.kind === "typing") {
    return renderTypingIndicator(t);
  }

  if (item.kind === "reasoning") {
    return renderReasoningItem(item, t);
  }

  if (item.kind === "search-tool") {
    return (
      <Message from="assistant" className="max-w-full">
        <SearchToolStep toolStep={item.toolStep} t={t} />
      </Message>
    );
  }

  if (item.kind === "weather-tool") {
    const widgetProps = item.payload as WeatherWidgetProps;

    return (
      <Message from="assistant" className="max-w-full">
        <WeatherWidget
          {...widgetProps}
          className="w-88 max-w-full sm:w-[24rem]"
        />
      </Message>
    );
  }

  if (item.kind === "tool-status") {
    return <ToolStatus toolStep={item.toolStep} t={t} />;
  }

  if (item.from === "user") {
    return (
      <Message from="user">
        <MessageContent>{item.text}</MessageContent>
      </Message>
    );
  }

  return (
    <Message from="assistant">
      <div className="flex flex-col gap-2">
        <MessageContent>
          {renderInlineCitationResponse(
            item.text,
            item.isStreaming ?? false,
            item.sources,
            t,
          )}
        </MessageContent>
        {!item.isStreaming ? (
          <MessageToolbar>
            <MessageActions>
              <CopyMessageAction content={item.text} label={t("common.copy")} />
              {item.references?.length ? (
                <SourceReferencesSheet
                  sources={item.references}
                  isActive={
                    activeReferenceKey ===
                    buildSourceSelectionKey(item.references)
                  }
                  onToggle={(sources, key) =>
                    onToggleReferences?.(sources, key)
                  }
                  getAvatarText={(source) =>
                    getSourceAvatarText(
                      source.fileName,
                      t("chat.messages.sourceAvatarFallback"),
                    )
                  }
                />
              ) : null}
            </MessageActions>
          </MessageToolbar>
        ) : null}
      </div>
    </Message>
  );
}

export function ChatMessages({
  messages,
  isLoading,
  isInitialLoading,
  activeReferenceKey,
  onToggleReferences,
  pendingApprovals = [],
  approvalProcessingIds = [],
  onApproveApproval,
  onRejectApproval,
}: ChatMessagesProps) {
  const t = useTranslations();
  const items = buildRenderItems(messages, isLoading);

  if (isInitialLoading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Loader className="h-4 w-4 animate-spin text-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return renderEmptyState(t);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation
        className="min-h-0 flex-1"
        initial={isLoading ? "smooth" : "instant"}
        resize={isLoading ? "smooth" : "instant"}
      >
        <ConversationContent className="p-0">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4 pb-12">
            {items.map((item) => (
              <div key={item.id}>
                {renderItem(item, {
                  t,
                  activeReferenceKey,
                  onToggleReferences,
                })}
              </div>
            ))}

            {pendingApprovals.length > 0 ? (
              <div className="flex flex-col gap-3">
                {pendingApprovals.map((request) => (
                  <PendingApprovalCard
                    key={`${request.actionRequest.name}-${request.index}`}
                    request={request}
                    isProcessing={approvalProcessingIds.includes(request.index)}
                    onApprove={onApproveApproval}
                    onReject={onRejectApproval}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
    </div>
  );
}
