import type { BaseMessage } from "@langchain/core/messages";
import {
  AIMessage,
  AIMessageChunk,
  isAIMessage,
  isHumanMessage,
  isToolMessage,
} from "@langchain/core/messages";

function pickToolCalls(ai: AIMessage | AIMessageChunk): unknown[] | undefined {
  const raw = ai.tool_calls;
  if (!raw?.length) return undefined;
  return raw.map((tc) => ({
    id: tc.id,
    name: tc.name,
    args: tc.args,
  }));
}

/** 仅透传工作流检索助理消息的持久化快照，避免把整个 additional_kwargs 打到 SSE */
export function pickWebSearchWorkflowKwargs(
  additionalKwargs: unknown,
): Record<string, unknown> | undefined {
  if (!additionalKwargs || typeof additionalKwargs !== "object")
    return undefined;
  const ak = additionalKwargs as Record<string, unknown>;
  const wf = ak.web_search_workflow;
  const sources = ak.web_search_sources;
  if (wf == null && sources == null) return undefined;
  const out: Record<string, unknown> = {};
  if (wf != null) out.web_search_workflow = wf;
  if (sources != null) out.web_search_sources = sources;
  return out;
}

/**
 * LangGraph `streamMode: "messages"` 的一条 chunk 为 `[serializedMessage, metadata]`。
 * `@langchain/langgraph-sdk` 的 StreamManager 依赖该元组形状，此处只精简两端字段，不改结构。
 */
export function slimLangGraphMessagesStreamChunk(chunk: unknown): unknown {
  if (!Array.isArray(chunk) || chunk.length !== 2) return chunk;

  const [msg, meta] = chunk;
  const slimMsg = slimMessagePayload(msg);
  const slimMeta = slimStreamMeta(meta);
  return [slimMsg, slimMeta];
}

function slimStreamMeta(meta: unknown): Record<string, unknown> {
  if (!meta || typeof meta !== "object") return {};
  const m = meta as Record<string, unknown>;
  const node = m.langgraph_node;
  const out: Record<string, unknown> = {};
  if (typeof node === "string" && node.length > 0) out.langgraph_node = node;
  return out;
}

function slimMessagePayload(msg: unknown): Record<string, unknown> {
  if (msg != null && typeof msg === "object" && isBaseMessageLike(msg)) {
    return slimLiveMessage(msg);
  }
  if (msg != null && typeof msg === "object" && isLcConstructorBlob(msg)) {
    return slimLcConstructorMessage(msg);
  }
  return { type: "unknown", raw: msg };
}

function isBaseMessageLike(m: object): m is BaseMessage {
  return "getType" in m && typeof (m as BaseMessage).getType === "function";
}

function isLcConstructorBlob(
  m: object,
): m is { id: string[]; kwargs: Record<string, unknown> } {
  return (
    "lc" in m &&
    (m as { lc?: unknown }).lc === 1 &&
    "type" in m &&
    (m as { type?: unknown }).type === "constructor" &&
    "id" in m &&
    Array.isArray((m as { id?: unknown }).id) &&
    "kwargs" in m &&
    typeof (m as { kwargs?: unknown }).kwargs === "object" &&
    (m as { kwargs: object }).kwargs != null
  );
}

function slimLiveMessage(m: BaseMessage): Record<string, unknown> {
  if (isHumanMessage(m)) {
    return { type: "human", id: m.id, content: m.content };
  }
  if (m instanceof AIMessageChunk) {
    const row: Record<string, unknown> = {
      type: "ai",
      id: m.id,
      content: m.content,
    };
    if (m.tool_call_chunks?.length) row.tool_call_chunks = m.tool_call_chunks;
    const ak = pickWebSearchWorkflowKwargs(m.additional_kwargs);
    if (ak) row.additional_kwargs = ak;
    return row;
  }
  if (isAIMessage(m)) {
    const row: Record<string, unknown> = {
      type: "ai",
      id: m.id,
      content: m.content,
    };
    const tc = pickToolCalls(m);
    if (tc?.length) row.tool_calls = tc;
    const ak = pickWebSearchWorkflowKwargs(m.additional_kwargs);
    if (ak) row.additional_kwargs = ak;
    return row;
  }
  if (isToolMessage(m)) {
    const body =
      typeof m.content === "string"
        ? m.content
        : JSON.stringify(m.content ?? "");
    return {
      type: "tool",
      id: m.id,
      tool_call_id: m.tool_call_id,
      name: m.name,
      content: body,
      status: m.status,
    };
  }
  return { type: m.getType(), id: m.id, content: m.content };
}

function slimLcConstructorMessage(msg: {
  id: string[];
  kwargs: Record<string, unknown>;
}): Record<string, unknown> {
  const k = msg.kwargs;
  const id = typeof k.id === "string" ? k.id : undefined;
  const content = k.content;
  const toolCalls = k.tool_calls;
  const toolCallChunks = k.tool_call_chunks;
  const toolCallId = k.tool_call_id;
  const name = k.name;

  const ids = msg.id;
  const roleHint = Array.isArray(ids) ? ids[ids.length - 1] : "";

  if (toolCallId != null) {
    return {
      type: "tool",
      id,
      tool_call_id: toolCallId,
      name,
      content: typeof content === "string" ? content : String(content ?? ""),
      status: k.status,
    };
  }

  if (roleHint === "AIMessageChunk" || roleHint === "AIMessage") {
    const row: Record<string, unknown> = {
      type: "ai",
      id,
      content,
    };
    if (Array.isArray(toolCallChunks) && toolCallChunks.length)
      row.tool_call_chunks = toolCallChunks;
    if (Array.isArray(toolCalls) && toolCalls.length)
      row.tool_calls = toolCalls;
    const ak = pickWebSearchWorkflowKwargs(k.additional_kwargs);
    if (ak) row.additional_kwargs = ak;
    return row;
  }

  if (roleHint === "HumanMessage") {
    return { type: "human", id, content };
  }

  const row: Record<string, unknown> = { type: "ai", id, content };
  if (Array.isArray(toolCallChunks) && toolCallChunks.length)
    row.tool_call_chunks = toolCallChunks;
  if (Array.isArray(toolCalls) && toolCalls.length) row.tool_calls = toolCalls;
  const ak = pickWebSearchWorkflowKwargs(k.additional_kwargs);
  if (ak) row.additional_kwargs = ak;
  return row;
}
