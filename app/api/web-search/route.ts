import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createLangChainChatModel } from "@/lib/ai/langchain-model";
import type { ChatModelProvider } from "@/lib/ai/model-provider";
import { compileWebSearchAgentGraph } from "@/lib/ai/graphs/web-search-agent-graph";
import { getLangGraphCheckpointer } from "@/lib/ai/checkpointer";
import { getSessionFromHeaders } from "@/lib/auth-utils";
import {
  applyWorkflowFinalize,
  createInitialWebSearchWorkflowRoot,
  type WebSearchWorkflowRoot,
} from "@/lib/ai/web-search-workflow-state";
import { jsonErrorResponse } from "@/lib/api/responses";
import { normalizeWebSearchRequest } from "@/lib/api/web-search-body";
import { slimLangGraphMessagesStreamChunk } from "@/lib/ai/slim-langgraph-messages-stream";
import { serializeWebSearchCheckpointMessages } from "@/lib/ai/web-search-checkpoint-messages";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * 跳过无意义的 workflow custom（如初始 IN_PROGRESS + 空 plan/steps），减少 SSE 噪音；
 * 终态 COMPLETED/FAILED 仍下发，便于客户端结束 loading。
 */
function shouldSkipNoisyWebSearchCustomPayload(payload: unknown): boolean {
  if (!isRecord(payload) || payload.intended_usage !== "workflow_root") {
    return false;
  }
  const wb = payload.workflow_block;
  if (!isRecord(wb)) return false;
  const plan = wb.plan;
  const steps = wb.steps;
  const empty =
    Array.isArray(plan) &&
    plan.length === 0 &&
    Array.isArray(steps) &&
    steps.length === 0;
  if (!empty) return false;
  const st = wb.status;
  if (st === "WORKFLOW_COMPLETED" || st === "WORKFLOW_FAILED") return false;
  return true;
}

/** 规划节点 LLM 只产出 JSON，不应作为对话正文流给前端（否则会与 synthesize 的 Markdown 一起展示）。 */
function isInternalWebSearchPlanMessagesChunk(chunk: unknown): boolean {
  if (!Array.isArray(chunk) || chunk.length !== 2) return false;
  const meta = chunk[1];
  if (!meta || typeof meta !== "object") return false;
  return (meta as { langgraph_node?: unknown }).langgraph_node === "plan";
}

async function compileWebSearchGraphForThread(
  modelName: string,
  modelProvider: ChatModelProvider,
) {
  const checkpointer = process.env.DATABASE_URL?.trim()
    ? await getLangGraphCheckpointer()
    : new MemorySaver();
  const baseModel = createLangChainChatModel(modelName, modelProvider);
  return compileWebSearchAgentGraph({
    model: baseModel,
    planModel: baseModel,
    checkpointer,
  });
}

function parseModelProviderParam(
  raw: string | null,
): ChatModelProvider | null {
  return raw === "openai" || raw === "anthropic" ? raw : null;
}

/** 刷新后从 Postgres/Memory checkpoint 拉取 thread 消息，供前端 initialValues */
export async function GET(request: NextRequest) {
  try {
    const requestHeaders = await headers();
    const { session } = await getSessionFromHeaders(requestHeaders);
    if (!session) {
      return jsonErrorResponse(401, "Unauthorized");
    }

    const threadId = request.nextUrl.searchParams.get("threadId")?.trim();
    if (!threadId) {
      return jsonErrorResponse(400, "Missing threadId");
    }

    const modelName = request.nextUrl.searchParams.get("model")?.trim() ?? "";
    if (!modelName) {
      return jsonErrorResponse(400, "Missing model");
    }
    const modelProvider = parseModelProviderParam(
      request.nextUrl.searchParams.get("modelProvider"),
    );
    if (!modelProvider) {
      return jsonErrorResponse(400, "Missing or invalid modelProvider");
    }

    const graph = await compileWebSearchGraphForThread(
      modelName,
      modelProvider,
    );
    const snap = await graph.getState({
      configurable: { thread_id: threadId },
    });
    const rawMessages = (snap?.values as { messages?: unknown[] } | null)
      ?.messages;
    const messages = serializeWebSearchCheckpointMessages(rawMessages);

    return Response.json({ messages });
  } catch (error) {
    console.error("Web search thread state error:", error);
    return jsonErrorResponse(500, "Failed to load thread");
  }
}

export async function POST(request: NextRequest) {
  try {
    const requestHeaders = await headers();
    const { session } = await getSessionFromHeaders(requestHeaders);
    if (!session) {
      return jsonErrorResponse(401, "Unauthorized");
    }

    const raw = await request.json();
    let data: ReturnType<typeof normalizeWebSearchRequest>;
    try {
      data = normalizeWebSearchRequest(raw);
    } catch {
      return jsonErrorResponse(400, "Invalid input");
    }

    const modelName = data.model?.trim() ?? "";
    if (!modelName) {
      return jsonErrorResponse(400, "Missing model");
    }
    if (data.modelProvider !== "openai" && data.modelProvider !== "anthropic") {
      return jsonErrorResponse(400, "Missing or invalid modelProvider");
    }
    const modelProvider = data.modelProvider;

    const threadId = data.checkpointThreadId?.trim() || randomUUID();
    /** 配置 DATABASE_URL 时始终用 PostgresSaver（与 useStream 的 configurable.thread_id 多轮一致）；否则开发环境可仅用内存 */
    const checkpointer = process.env.DATABASE_URL?.trim()
      ? await getLangGraphCheckpointer()
      : new MemorySaver();

    const initialWorkflow = createInitialWebSearchWorkflowRoot();

    const baseModel = createLangChainChatModel(modelName, modelProvider);
    const graph = compileWebSearchAgentGraph({
      model: baseModel,
      planModel: baseModel,
      checkpointer,
    });

    const streamConfig = {
      configurable: {
        thread_id: threadId,
      },
    };

    let streamPreWorkflow: WebSearchWorkflowRoot = initialWorkflow;
    let streamHasMessageHistory = false;
    try {
      const preSnap = await graph.getState(streamConfig);
      const preVals = preSnap?.values as
        | { messages?: unknown[]; workflow_root?: WebSearchWorkflowRoot }
        | undefined;
      if (preVals?.workflow_root) streamPreWorkflow = preVals.workflow_root;
      streamHasMessageHistory = Boolean(
        preVals?.messages && preVals.messages.length > 0,
      );
    } catch {
      /* 新 thread 或无 checkpoint */
    }

    const streamInput: {
      messages: HumanMessage[];
      workflow_root?: WebSearchWorkflowRoot;
      use_web_search: boolean;
    } = {
      messages: [new HumanMessage(data.query)],
      use_web_search: data.enableWebSearch,
    };
    if (!streamHasMessageHistory) {
      streamInput.workflow_root = initialWorkflow;
    }

    const rawStream = await graph.stream(streamInput, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      streamMode: ["messages", "custom", "values"] as any,
      ...streamConfig,
    });

    const encoder = new TextEncoder();
    const emitSse = (
      controller: ReadableStreamDefaultController<Uint8Array>,
      event: string,
      payload: unknown,
    ) => {
      const serialized =
        typeof payload === "string" ? payload : JSON.stringify(payload);
      controller.enqueue(
        encoder.encode(`event: ${event}\ndata: ${serialized}\n\n`),
      );
    };

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let completedOk = true;
        /** 多轮续聊时 checkpoint 里的 workflow 仍是上一轮终态，预发射会误导前端；本轮由图内 custom 更新 */
        if (
          !streamHasMessageHistory &&
          !shouldSkipNoisyWebSearchCustomPayload(streamPreWorkflow)
        ) {
          emitSse(controller, "custom", streamPreWorkflow);
        }

        try {
          for await (const [streamMode, chunk] of rawStream as AsyncIterable<
            [string, unknown]
          >) {
            if (streamMode === "messages") {
              if (isInternalWebSearchPlanMessagesChunk(chunk)) continue;
              emitSse(
                controller,
                "messages",
                slimLangGraphMessagesStreamChunk(chunk),
              );
            } else if (streamMode === "custom") {
              if (shouldSkipNoisyWebSearchCustomPayload(chunk)) continue;
              emitSse(controller, "custom", chunk);
            } else if (streamMode === "values") {
              if (
                chunk &&
                typeof chunk === "object" &&
                "__interrupt__" in chunk
              ) {
                emitSse(controller, "values", chunk);
              }
            }
          }
        } catch (error) {
          completedOk = false;
          console.error("Web search stream error:", error);
          const message =
            error instanceof Error ? error.message : String(error);
          emitSse(controller, "error", { error: message, message });
        } finally {
          let finalRoot: WebSearchWorkflowRoot = initialWorkflow;
          try {
            const snap = await graph.getState(streamConfig);
            const wf = (
              snap.values as
                | { workflow_root?: WebSearchWorkflowRoot }
                | null
                | undefined
            )?.workflow_root;
            if (wf) finalRoot = wf;
          } catch {
            // MemorySaver / 单次请求下 getState 失败时仍用初始快照做 finalize
          }
          emitSse(
            controller,
            "custom",
            applyWorkflowFinalize(finalRoot, completedOk),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Web-Search-Thread-Id": threadId,
      },
    });
  } catch (error) {
    console.error("Web search error:", error);
    return jsonErrorResponse(500, "Web search failed");
  }
}
