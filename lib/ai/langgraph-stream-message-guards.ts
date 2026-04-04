import type {
  AIMessage as SdkAIMessage,
  HumanMessage as SdkHumanMessage,
  Message,
} from "@langchain/langgraph-sdk";
import {
  AIMessage,
  type BaseMessage,
  HumanMessage,
} from "@langchain/core/messages";
import type { WebSearchWorkflowRoot } from "@/lib/ai/web-search-workflow-state";
import type { CitationSource } from "@/lib/db/schema";
import {
  parseWebSearchSourcesCustomPayload,
  parseWebSearchWorkflowCustomPayload,
} from "@/lib/web-search/parse-workflow-payload";

/**
 * LangGraph SDK 的可序列化 `{ type, content, ... }` 与 `@langchain/react` 里 `useStream` 返回的
 * `@langchain/core` BaseMessage 子类在 UI 侧可同等处理。
 */
export type StreamCompatibleMessage = Message | BaseMessage;

/**
 * 优先用 `@langchain/core/messages` 上的 `isInstance`（勿从 `langchain` 包导入，以免打全量入口并拉取 LangGraph / node:async_hooks 到客户端）。
 * 对无 MESSAGE_SYMBOL 的 SDK 字面量（如历史 initialValues）再按 `type` 收窄。
 */
export function isStreamAIMessage(
  m: StreamCompatibleMessage,
): m is SdkAIMessage | AIMessage {
  if (AIMessage.isInstance(m)) return true;
  return (m as Message).type === "ai";
}

export function isStreamHumanMessage(
  m: StreamCompatibleMessage,
): m is SdkHumanMessage | HumanMessage {
  if (HumanMessage.isInstance(m)) return true;
  return (m as Message).type === "human";
}

function getAdditionalKwargs(
  m: StreamCompatibleMessage,
): Record<string, unknown> | undefined {
  if (!isStreamAIMessage(m)) return undefined;
  const ak =
    "additional_kwargs" in m &&
    m.additional_kwargs &&
    typeof m.additional_kwargs === "object"
      ? (m.additional_kwargs as Record<string, unknown>)
      : undefined;
  return ak;
}

/** 从助理消息的 `additional_kwargs.web_search_workflow` 读取 checkpoint / SSE 中的快照 */
export function getWebSearchWorkflowFromStreamMessage(
  m: StreamCompatibleMessage,
): WebSearchWorkflowRoot | null {
  return parseWebSearchWorkflowCustomPayload(
    getAdditionalKwargs(m)?.web_search_workflow,
  );
}

/** 从助理消息的 `additional_kwargs.web_search_sources` 读取 checkpoint / SSE 中的来源列表 */
export function getWebSearchSourcesFromStreamMessage(
  m: StreamCompatibleMessage,
): CitationSource[] | null {
  const sources = getAdditionalKwargs(m)?.web_search_sources;
  return parseWebSearchSourcesCustomPayload({
    intended_usage: "web_search_sources",
    sources,
  });
}
