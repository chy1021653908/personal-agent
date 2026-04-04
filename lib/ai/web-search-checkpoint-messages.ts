import type { BaseMessage } from "@langchain/core/messages";
import { isAIMessage, isHumanMessage } from "@langchain/core/messages";
import { pickWebSearchWorkflowKwargs } from "@/lib/ai/slim-langgraph-messages-stream";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * 将 LangGraph checkpoint 中的消息转为 `useStream` / MessageTupleManager 可用的字面量
 *（与 SSE slim 形状一致，含 `additional_kwargs.web_search_workflow`）。
 */
export function serializeWebSearchCheckpointMessages(
  messages: BaseMessage[] | unknown[] | undefined,
): Record<string, unknown>[] {
  if (!messages?.length) return [];
  const out: Record<string, unknown>[] = [];
  for (const m of messages) {
    if (isHumanMessage(m as BaseMessage)) {
      const h = m as BaseMessage;
      out.push({
        type: "human",
        id: h.id,
        content: h.content,
      });
      continue;
    }
    if (isAIMessage(m as BaseMessage)) {
      const a = m as BaseMessage & { additional_kwargs?: unknown };
      const row: Record<string, unknown> = {
        type: "ai",
        id: a.id,
        content: a.content,
      };
      const ak = pickWebSearchWorkflowKwargs(a.additional_kwargs);
      if (ak) row.additional_kwargs = ak;
      out.push(row);
      continue;
    }
    if (!isRecord(m)) continue;
    const t = m.type;
    if (t === "human" || t === "user") {
      out.push({
        type: "human",
        id: m.id,
        content: m.content,
      });
      continue;
    }
    if (t === "ai" || t === "assistant") {
      const row: Record<string, unknown> = {
        type: "ai",
        id: m.id,
        content: m.content,
      };
      const ak = pickWebSearchWorkflowKwargs(m.additional_kwargs);
      if (ak) row.additional_kwargs = ak;
      out.push(row);
    }
  }
  return out;
}
