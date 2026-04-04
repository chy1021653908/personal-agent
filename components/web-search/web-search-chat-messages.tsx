"use client";

import type { StreamCompatibleMessage } from "@/lib/ai/langgraph-stream-message-guards";
import {
  getWebSearchWorkflowFromStreamMessage,
  getWebSearchSourcesFromStreamMessage,
  isStreamAIMessage,
  isStreamHumanMessage,
} from "@/lib/ai/langgraph-stream-message-guards";
import type {
  WebSearchWorkflowRoot,
  WorkflowPlanStep,
  WorkflowSourcePayload,
  WorkflowStep,
} from "@/lib/ai/web-search-workflow-state";
import { renderCitationTags } from "@/lib/ai/inline-citation-tags";
import { getSourceLink } from "@/lib/ai/source";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
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
  buildSourceSelectionKey,
  SourceReferencesSheet,
} from "@/components/source-references-sheet";
import { cn } from "@/lib/utils";
import type { Source } from "@/types";
import { CheckCircle2, Loader, Search as SearchIcon } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { useTranslations } from "next-intl";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "string") return block;
        if (!isRecord(block)) return "";
        if (block.type === "text" && typeof block.text === "string") {
          return block.text;
        }
        return "";
      })
      .join("");
  }
  if (isRecord(content) && typeof content.text === "string") {
    return content.text;
  }
  return "";
}

function sourceTypeLabel(
  source: Source,
  t: ReturnType<typeof useTranslations>,
): string {
  const url = getSourceLink(source);
  if (!url) {
    return source.source === "knowledge_base"
      ? t("common.document")
      : t("common.source");
  }
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host || t("common.webPage");
  } catch {
    return t("common.webPage");
  }
}

function collectQueries(exec: WorkflowStep[]): string[] {
  const out: string[] = [];
  for (const st of exec) {
    for (const it of st.items) {
      if (it.type === "WORKFLOW_ITEM_QUERIES") {
        out.push(...it.queries);
      }
    }
  }
  return [...new Set(out)];
}

function collectSources(exec: WorkflowStep[]): WorkflowSourcePayload[] {
  const out: WorkflowSourcePayload[] = [];
  for (const st of exec) {
    for (const it of st.items) {
      if (it.type === "WORKFLOW_ITEM_SOURCES") {
        out.push(...it.sources);
      }
    }
  }
  return out;
}

type PlanRowView = {
  plan: WorkflowPlanStep;
  executions: WorkflowStep[];
};

function buildPlanRows(
  root: WebSearchWorkflowRoot | null,
  t: ReturnType<typeof useTranslations>,
): PlanRowView[] {
  if (!root?.workflow_block) return [];
  const { plan, steps } = root.workflow_block;

  if (!plan.length) {
    if (!steps.length) return [];
    const pseudo: WorkflowPlanStep = {
      id: "_exec",
      index: 1,
      title: t("webSearch.messages.defaultPlanTitle"),
      status: "COMPLETED",
    };
    return [{ plan: pseudo, executions: steps }];
  }

  const rows = plan.map((p) => ({
    plan: p,
    executions: steps.filter((s) => s.plan_step_index === p.index),
  }));

  const orphans = steps.filter((s) => s.plan_step_index == null);
  if (orphans.length > 0 && rows.length > 0) {
    rows[rows.length - 1].executions.push(...orphans);
  }

  return rows;
}

function planToStepStatus(
  s: WorkflowPlanStep["status"],
): "complete" | "active" | "pending" {
  switch (s) {
    case "IN_PROGRESS":
      return "active";
    case "COMPLETED":
    case "FAILED":
    case "SKIPPED":
      return "complete";
    default:
      return "pending";
  }
}

function AutoCollapseChainOfThought({
  active,
  header,
  children,
}: {
  active: boolean;
  header: string;
  children: ReactNode;
}) {
  return (
    <ChainOfThought
      key={active ? "chain-active" : "chain-complete"}
      defaultOpen={active}
    >
      <ChainOfThoughtHeader>{header}</ChainOfThoughtHeader>
      <ChainOfThoughtContent>{children}</ChainOfThoughtContent>
    </ChainOfThought>
  );
}

function WebSearchRetrievalChain({
  workflow,
  isLoading,
  assistantHasContent,
  t,
}: {
  workflow: WebSearchWorkflowRoot | null;
  isLoading: boolean;
  assistantHasContent: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const rows = useMemo(() => buildPlanRows(workflow, t), [t, workflow]);
  /** 与后端一致：检索节点结束即置 `WORKFLOW_COMPLETED` 并 custom 下发，早于正文 messages。 */
  const workflowPhaseDone =
    workflow?.workflow_block.status === "WORKFLOW_COMPLETED" ||
    workflow?.workflow_block.status === "WORKFLOW_FAILED";
  const hasActivePlan = rows.some(
    (r) => r.plan.status === "IN_PROGRESS" || r.plan.status === "PENDING",
  );
  const active = !workflowPhaseDone && (isLoading || hasActivePlan);
  const chainHeaderText = active
    ? t("webSearch.messages.thinking")
    : t("webSearch.messages.thoughtComplete");

  const allPlanTerminal = useMemo(
    () =>
      rows.length > 0 &&
      rows.every((r) =>
        ["COMPLETED", "FAILED", "SKIPPED"].includes(r.plan.status),
      ),
    [rows],
  );
  const showCompletedChain = allPlanTerminal && assistantHasContent;

  if (!isLoading && rows.length === 0) {
    return null;
  }

  return (
    <AutoCollapseChainOfThought active={active} header={chainHeaderText}>
      <>
        {rows.map(({ plan: p, executions }) => {
          const queries = collectQueries(executions);
          const sources = collectSources(executions);
          const pillQueries = queries;

          return (
            <ChainOfThoughtStep
              key={p.id}
              icon={SearchIcon}
              status={planToStepStatus(p.status)}
              label={p.title}
            >
              {pillQueries.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {t("common.searching")}
                  </p>
                  <ChainOfThoughtSearchResults>
                    {pillQueries.map((q) => (
                      <ChainOfThoughtSearchResult key={q}>
                        <SearchIcon className="size-3" />
                        <span className="max-w-md truncate">{q}</span>
                      </ChainOfThoughtSearchResult>
                    ))}
                  </ChainOfThoughtSearchResults>
                </div>
              ) : null}

              {sources.length > 0 ? (
                <>
                  <div className="max-h-60 overflow-y-auto rounded-md border bg-background">
                    {sources.map((source, i) => {
                      const link = getSourceLink(source);
                      const typeLabel = sourceTypeLabel(source, t);
                      const rowClass =
                        "flex items-center justify-between gap-3 border-b px-3 py-2 text-xs last:border-b-0";
                      return link ? (
                        <a
                          key={`${link}-${i}`}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(rowClass, "hover:bg-muted/60")}
                        >
                          <span className="truncate text-foreground">
                            {source.fileName}
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {typeLabel}
                          </span>
                        </a>
                      ) : (
                        <div
                          key={`${source.fileName}-${i}`}
                          className={rowClass}
                        >
                          <span className="truncate text-foreground">
                            {source.fileName}
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {typeLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </ChainOfThoughtStep>
          );
        })}
        {showCompletedChain ? (
          <ChainOfThoughtStep
            icon={CheckCircle2}
            label={t("common.complete")}
          />
        ) : null}
      </>
    </AutoCollapseChainOfThought>
  );
}

function domainAbbr(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.slice(0, 2).toUpperCase();
  } catch {
    return url.slice(0, 2).toUpperCase() || "?";
  }
}

function WebSearchMessageResponse({
  text,
  sources,
  isStreaming,
  activeReferenceKey,
  onToggleReferences,
}: {
  text: string;
  sources: Source[] | null;
  isStreaming: boolean;
  activeReferenceKey?: string | null;
  onToggleReferences?: (sources: Source[], key: string) => void;
}) {
  const sourceByIndex = useMemo(() => {
    const map = new Map<number, Source>();
    for (const s of sources ?? []) {
      if (typeof s.index === "number") {
        map.set(s.index, s);
      }
    }
    return map;
  }, [sources]);

  const processedText = useMemo(
    () => (sources && sources.length > 0 ? renderCitationTags(text) : text),
    [text, sources],
  );

  return (
    <>
      <MessageResponse
        mode="streaming"
        animated={false}
        isAnimating={isStreaming}
        caret={isStreaming ? "circle" : undefined}
        allowedTags={{ citation: ["source"] }}
        components={{
          citation: (props: Record<string, unknown>) => {
            const idx = Number(props.source);
            const src = Number.isInteger(idx)
              ? sourceByIndex.get(idx)
              : undefined;
            if (!src) {
              return (
                <span className="text-xs text-muted-foreground">[{idx}]</span>
              );
            }
            return (
              <InlineCitation>
                <InlineCitationCard>
                  <InlineCitationCardTrigger
                    sources={[
                      getUrlDomain(getSourceLink(src) ?? src.documentId) ||
                        src.fileName,
                    ]}
                    className="h-5 rounded-md px-1.5 text-[11px]"
                  />
                  <InlineCitationCardBody>
                    <InlineCitationCarousel>
                      <InlineCitationCarouselContent>
                        <InlineCitationCarouselItem>
                          <InlineCitationSource
                            title={src.fileName}
                            url={getSourceLink(src)}
                            description={src.content}
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
      {sources && sources.length > 0 && !isStreaming ? (
        <div className="mt-3">
          <SourceReferencesSheet
            sources={sources}
            isActive={activeReferenceKey === buildSourceSelectionKey(sources)}
            onToggle={(nextSources, key) =>
              onToggleReferences?.(nextSources, key)
            }
            getAvatarText={(source) => {
              const link = getSourceLink(source);
              return domainAbbr(link || source.fileName);
            }}
          />
        </div>
      ) : null}
    </>
  );
}

export function WebSearchChatMessages({
  messages,
  workflow,
  workflowByMessageId = {},
  sources,
  sourcesByMessageId = {},
  isLoading,
  isInitialLoading = false,
  activeReferenceKey,
  onToggleReferences,
}: {
  messages: StreamCompatibleMessage[];
  workflow: WebSearchWorkflowRoot | null;
  /** 发起下一轮前从 custom 固化到上一则助理消息 id，弥补 messages 流未合并 additional_kwargs 的情况 */
  workflowByMessageId?: Record<string, WebSearchWorkflowRoot>;
  /** 全部搜索完成后的汇总来源（当前流） */
  sources?: Source[] | null;
  /** 按消息 id 存储的历史来源 */
  sourcesByMessageId?: Record<string, Source[]>;
  isLoading: boolean;
  /** 从服务端拉取 thread 历史完成前为 true，与对话页一致展示全屏 loading */
  isInitialLoading?: boolean;
  activeReferenceKey?: string | null;
  onToggleReferences?: (sources: Source[], key: string) => void;
}) {
  const t = useTranslations();
  const lastHumanIdx = useMemo(() => {
    let i = -1;
    messages.forEach((m, idx) => {
      if (isStreamHumanMessage(m)) i = idx;
    });
    return i;
  }, [messages]);

  const afterLastHuman =
    lastHumanIdx >= 0 ? messages.slice(lastHumanIdx + 1) : [];

  const lastIdx = messages.length - 1;

  const showTrailingChain =
    lastIdx >= 0 &&
    isStreamHumanMessage(messages[lastIdx]!) &&
    isLoading &&
    workflow != null &&
    Boolean(workflow.workflow_block.plan.length);

  const loadingDots =
    isLoading && afterLastHuman.length === 0 && lastHumanIdx >= 0;

  if (isInitialLoading) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-hidden">
        <div className="flex flex-col items-center gap-2">
          <Loader className="h-5 w-5 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="p-0">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 px-4 pb-12">
            {messages.map((m, idx) => {
              if (isStreamHumanMessage(m)) {
                const text = extractText(m.content);
                return (
                  <Message key={m.id} from="user">
                    <MessageContent>
                      <p className="whitespace-pre-wrap wrap-break-word">
                        {text}
                      </p>
                    </MessageContent>
                  </Message>
                );
              }
              if (isStreamAIMessage(m)) {
                const text = extractText(m.content).trim();
                const mid = m.id != null ? String(m.id) : "";
                const storedSnapshot = mid
                  ? workflowByMessageId[mid]
                  : undefined;
                const persisted = getWebSearchWorkflowFromStreamMessage(m);
                const useLiveWorkflow =
                  idx === lastIdx &&
                  !persisted &&
                  !storedSnapshot &&
                  workflow != null &&
                  Boolean(workflow.workflow_block.plan.length);
                const chainWf =
                  persisted ??
                  storedSnapshot ??
                  (useLiveWorkflow ? workflow : null);
                const showChain =
                  chainWf != null &&
                  Boolean(chainWf.workflow_block.plan.length);
                const chainLoading = Boolean(
                  isLoading && !persisted && !storedSnapshot && idx === lastIdx,
                );

                const persistedSources =
                  getWebSearchSourcesFromStreamMessage(m);
                const storedSources = mid ? sourcesByMessageId[mid] : undefined;
                const useLiveSources =
                  idx === lastIdx && !persistedSources && !storedSources;
                const msgSources =
                  persistedSources ??
                  storedSources ??
                  (useLiveSources ? sources : null) ??
                  null;
                const isLastStreaming = isLoading && idx === lastIdx;

                return (
                  <Message key={m.id} from="assistant" className="max-w-full">
                    <MessageContent className="max-w-[min(100%,720px)]">
                      {showChain ? (
                        <div className="max-w-[80%]">
                          <WebSearchRetrievalChain
                            workflow={chainWf}
                            isLoading={chainLoading}
                            assistantHasContent={text.length > 0}
                            t={t}
                          />
                        </div>
                      ) : null}
                      {text ? (
                        <WebSearchMessageResponse
                          text={text}
                          sources={msgSources}
                          isStreaming={isLastStreaming}
                          activeReferenceKey={activeReferenceKey}
                          onToggleReferences={onToggleReferences}
                        />
                      ) : null}
                    </MessageContent>
                  </Message>
                );
              }
              return null;
            })}
            {showTrailingChain ? (
              <Message from="assistant" className="max-w-full">
                <div className="max-w-[80%]">
                  <WebSearchRetrievalChain
                    workflow={workflow}
                    isLoading
                    assistantHasContent={false}
                    t={t}
                  />
                </div>
              </Message>
            ) : null}
            {loadingDots ? (
              <Message from="assistant">
                <MessageContent className="pt-1">
                  <div
                    className="inline-flex items-center gap-1 text-muted-foreground"
                    aria-label={t("webSearch.messages.generatingAria")}
                  >
                    <span
                      className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-[pulse_1.2s_ease-in-out_infinite]"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-[pulse_1.2s_ease-in-out_infinite]"
                      style={{ animationDelay: "200ms" }}
                    />
                    <span
                      className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-[pulse_1.2s_ease-in-out_infinite]"
                      style={{ animationDelay: "400ms" }}
                    />
                  </div>
                </MessageContent>
              </Message>
            ) : null}
          </div>
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
    </div>
  );
}
