import { NextRequest } from "next/server";
import { after } from "next/server";
import { headers } from "next/headers";
import { createUIMessageStreamResponse, type UIMessage } from "ai";
import { toBaseMessages, toUIMessageStream } from "@ai-sdk/langchain";
import { Command } from "@langchain/langgraph";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { getLangGraphCheckpointer } from "@/lib/ai/checkpointer";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth-utils";
import {
  type CitationSource,
  type MessagePart,
  type StoredToolPayload,
  conversations,
  messages,
} from "@/lib/db/schema";
import { jsonErrorResponse } from "@/lib/api/responses";
import {
  appendStoredSourcesFromCitationSources,
  buildStoredDynamicToolPart,
  createTextMessageParts,
  getStoredToolPayloadCitationSources,
  insertStoredSourcesPart,
  normalizeAssistantContentToParts,
} from "@/lib/ai/chat-ui-message";
import { and, desc, eq, gte } from "drizzle-orm";
import { createChatAgent } from "@/app/api/chat/agent";
import { buildChatTools } from "@/app/api/chat/tools";
import type { ChatModelProvider } from "@/lib/ai/model-provider";

export const maxDuration = 60;

interface StreamRequestBody {
  messages?: UIMessage[];
  conversationId?: string;
  context?: {
    model?: string;
    modelProvider?: ChatModelProvider;
    knowledgeBaseId?: string;
    retrievalScope?: "knowledge_base" | "folder" | "document" | "none";
    retrievalScopeId?: string;
  };
  command?: Record<string, unknown>;
}

async function insertStoredMessage(params: {
  conversationId: string;
  role: string;
  parts: MessagePart[];
  createdAt?: Date;
}): Promise<void> {
  const { conversationId, role, parts, createdAt } = params;
  await db.insert(messages).values({
    conversationId,
    role,
    parts,
    ...(createdAt ? { createdAt } : {}),
  });
}

async function getLastUserCreatedAt(
  conversationId: string,
): Promise<Date | null> {
  return (
    (
      await db
        .select({ createdAt: messages.createdAt })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            eq(messages.role, "user"),
          ),
        )
        .orderBy(desc(messages.createdAt))
        .limit(1)
    )[0]?.createdAt ?? null
  );
}

function getToolMessageId(msg: ToolMessage): string | undefined {
  return typeof msg.tool_call_id === "string"
    ? msg.tool_call_id
    : typeof msg.name === "string"
      ? msg.name
      : undefined;
}

function scanAssistantTools(valueMessages: Array<Record<string, unknown>>): {
  sources: CitationSource[];
  inputs: Map<string, StoredToolPayload>;
} {
  const sources: CitationSource[] = [];
  const seenCitationKeys = new Set<string>();
  const inputs = new Map<string, StoredToolPayload>();

  for (const msg of valueMessages) {
    if (ToolMessage.isInstance(msg)) {
      appendStoredSourcesFromCitationSources(
        getStoredToolPayloadCitationSources(msg.artifact ?? msg.content),
        sources,
        seenCitationKeys,
      );
      continue;
    }

    if (!AIMessage.isInstance(msg) || !Array.isArray(msg.tool_calls)) {
      continue;
    }

    for (const toolCall of msg.tool_calls) {
      if (
        !toolCall ||
        typeof toolCall !== "object" ||
        typeof toolCall.id !== "string"
      ) {
        continue;
      }

      if (toolCall.args === undefined) continue;
      inputs.set(toolCall.id, toolCall.args as StoredToolPayload);
    }
  }

  return { sources, inputs };
}

function buildToolMessagePart(
  msg: ToolMessage,
  inputs: Map<string, StoredToolPayload>,
) {
  const toolCallId = getToolMessageId(msg);
  const rawOutput = msg.artifact ?? msg.content;
  const output =
    rawOutput === undefined ? undefined : (rawOutput as StoredToolPayload);

  return buildStoredDynamicToolPart({
    toolName: typeof msg.name === "string" ? msg.name : undefined,
    toolCallId,
    state: "output-available",
    input: toolCallId ? inputs.get(toolCallId) : undefined,
    output,
  });
}

function buildAssistantPartsForStorage(
  valueMessages: Array<Record<string, unknown>>,
): MessagePart[] {
  const { sources, inputs } = scanAssistantTools(valueMessages);
  const orderedParts: MessagePart[] = [];
  let segmentLatestAssistantParts: MessagePart[] = [];

  const flushSegmentAssistantParts = () => {
    if (segmentLatestAssistantParts.length === 0) return;
    orderedParts.push(...segmentLatestAssistantParts);
    segmentLatestAssistantParts = [];
  };

  for (const msg of valueMessages) {
    if (ToolMessage.isInstance(msg)) {
      // Keep assistant content right before each tool to preserve turn order.
      flushSegmentAssistantParts();
      const toolPart = buildToolMessagePart(msg, inputs);
      if (toolPart) {
        orderedParts.push(toolPart);
      }
      continue;
    }

    if (!AIMessage.isInstance(msg)) {
      continue;
    }

    const messageParts = normalizeAssistantContentToParts(msg.contentBlocks);
    if (messageParts.length === 0) {
      continue;
    }

    // Keep only the latest renderable content inside one segment.
    // A segment is the range before the next tool message.
    segmentLatestAssistantParts = messageParts;
  }

  // Append the last assistant segment after the final tool (if any).
  flushSegmentAssistantParts();

  if (orderedParts.length === 0) {
    return [];
  }

  return insertStoredSourcesPart(orderedParts, sources);
}

function findLastUserMessageIndex(
  msgs: Array<Record<string, unknown>>,
): number {
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    if (HumanMessage.isInstance(msgs[i])) return i;
  }
  return -1;
}

function getCurrentTurnMessages(
  messages: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const lastUserIdx = findLastUserMessageIndex(messages);
  return lastUserIdx >= 0 ? messages.slice(lastUserIdx + 1) : messages;
}

function getNextCitationIndexFromMessages(
  messages: Array<Record<string, unknown>>,
): number {
  const currentTurnMessages = getCurrentTurnMessages(messages);
  const { sources } = scanAssistantTools(currentTurnMessages);
  const maxIndex = sources.reduce(
    (max, source) =>
      typeof source.index === "number" ? Math.max(max, source.index) : max,
    0,
  );

  return maxIndex + 1;
}

async function persistAssistantTurn(params: {
  conversationId: string;
  finalValuesMessages: Array<Record<string, unknown>>;
  currentTurnUserCreatedAt: Date | null;
}): Promise<void> {
  const { conversationId, finalValuesMessages, currentTurnUserCreatedAt } =
    params;

  if (finalValuesMessages.length === 0) {
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
    return;
  }

  const currentTurnMessages = getCurrentTurnMessages(finalValuesMessages);

  const assistantPartsForStorage =
    buildAssistantPartsForStorage(currentTurnMessages);

  if (assistantPartsForStorage.length === 0) {
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
    return;
  }

  const turnBoundary =
    currentTurnUserCreatedAt ?? (await getLastUserCreatedAt(conversationId));

  await db.transaction(async (tx) => {
    if (turnBoundary) {
      await tx
        .delete(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            eq(messages.role, "assistant"),
            gte(messages.createdAt, turnBoundary),
          ),
        );
    }

    await tx.insert(messages).values({
      conversationId,
      role: "assistant",
      parts: assistantPartsForStorage,
    });

    await tx
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
  });
}

async function getInitialCitationIndexForRequest(params: {
  isResume: boolean;
  conversationId: string;
  agent: ReturnType<typeof createChatAgent>;
}): Promise<number> {
  const { isResume, conversationId, agent } = params;
  if (!isResume) {
    return 1;
  }

  try {
    const snapshot = await agent.getState({
      configurable: { thread_id: conversationId },
    });
    const snapshotState = snapshot as
      | { values?: { messages?: unknown[] } }
      | null
      | undefined;
    const snapshotValues =
      snapshotState?.values && typeof snapshotState.values === "object"
        ? snapshotState.values
        : undefined;
    const messages = Array.isArray(snapshotValues?.messages)
      ? (snapshotValues.messages as Array<Record<string, unknown>>)
      : [];

    return getNextCitationIndexFromMessages(messages);
  } catch (error) {
    console.error("Failed to load chat checkpoint state:", error);
    return 1;
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1) 认证：仅允许登录用户访问聊天接口
    const requestHeaders = await headers();
    const { session } = await getSessionFromHeaders(requestHeaders);
    if (!session) {
      return jsonErrorResponse(401, "Unauthorized");
    }

    // 2) 解析请求体：前端仅发送当前最新一条消息
    const body = (await request.json()) as StreamRequestBody;
    const incomingUiMessages = Array.isArray(body.messages)
      ? body.messages
      : [];
    const conversationId =
      typeof body.conversationId === "string" ? body.conversationId : undefined;
    const resumeValue = body.command?.resume;
    const isResume = resumeValue !== undefined;

    if (!conversationId) {
      return jsonErrorResponse(400, "Missing conversationId");
    }

    // 3) 校验会话归属：只能访问当前用户自己的会话
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.userId, session.user.id),
        ),
      );

    if (!conversation) {
      return jsonErrorResponse(404, "Conversation not found");
    }

    // 4) 转换 UIMessage -> LangChain BaseMessage，并只取本轮最新 user 输入
    const baseMessages = await toBaseMessages(incomingUiMessages);
    const lastUserMessage = [...baseMessages]
      .reverse()
      .find((message): message is HumanMessage =>
        HumanMessage.isInstance(message),
      );
    const userContent = lastUserMessage?.text.trim() ?? "";

    if (!isResume && !userContent) {
      return jsonErrorResponse(400, "Missing user message");
    }

    // 5) 计算 RAG 上下文：仅基于本次请求的 context 决定是否启用知识库检索
    const context = body.context;
    const modelName = context?.model?.trim() ?? "";
    const modelProvider = context?.modelProvider;
    if (!modelName) {
      return jsonErrorResponse(400, "Missing model");
    }
    if (modelProvider !== "openai" && modelProvider !== "anthropic") {
      return jsonErrorResponse(400, "Missing or invalid modelProvider");
    }
    const requestKnowledgeBaseId = context?.knowledgeBaseId;
    const requestRetrievalScope = context?.retrievalScope;
    const requestRetrievalScopeId = context?.retrievalScopeId;

    const shouldRunRag =
      !isResume &&
      Boolean(requestKnowledgeBaseId) &&
      requestRetrievalScope !== "none";

    const checkpointer = await getLangGraphCheckpointer();
    const agent = createChatAgent({
      modelName,
      modelProvider,
      shouldRunRag,
      tools: [],
      checkpointer,
    });
    let nextCitationIndex = await getInitialCitationIndexForRequest({
      isResume,
      conversationId,
      agent,
    });
    const reserveCitationRange = (count: number) => {
      const normalizedCount = Math.max(0, Math.trunc(count));
      const startIndex = nextCitationIndex;
      nextCitationIndex += normalizedCount;
      return startIndex;
    };

    // 6) 预写入用户消息：仅在非 resume 且存在新用户输入时落库
    const persistUserMessagePromise: Promise<Date | null> =
      !isResume && userContent
        ? (async () => {
            const createdAt = new Date();
            await insertStoredMessage({
              conversationId,
              role: "user",
              parts: createTextMessageParts(userContent),
              createdAt,
            });
            return createdAt;
          })()
        : Promise.resolve(null);

    const tools = buildChatTools({
      shouldRunRag,
      requestKnowledgeBaseId,
      requestRetrievalScope,
      requestRetrievalScopeId,
      reserveCitationRange,
    });

    const runnableAgent = createChatAgent({
      modelName,
      modelProvider,
      shouldRunRag,
      tools,
      checkpointer,
    });

    const streamInput = isResume
      ? new Command({ resume: resumeValue })
      : {
          messages: [new HumanMessage(userContent)],
        };

    const langchainStream = await runnableAgent.stream(streamInput, {
      streamMode: ["values", "messages", "custom"],
      configurable: {
        thread_id: conversationId,
      },
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream<{ messages?: Array<Record<string, unknown>> }>(
        langchainStream,
        {
          onFinish: (finalState) => {
            const finalValuesMessages = Array.isArray(finalState?.messages)
              ? (finalState.messages as Array<Record<string, unknown>>)
              : [];

            after(async () => {
              try {
                const currentTurnUserCreatedAt =
                  await persistUserMessagePromise;

                await persistAssistantTurn({
                  conversationId,
                  finalValuesMessages,
                  currentTurnUserCreatedAt,
                });
              } catch (error) {
                console.error("Failed to persist chat turn:", error);
              }
            });
          },
          onError: (error) => {
            console.error("Chat stream error:", error);
          },
          onAbort: () => {
            console.log("Chat stream aborted by client");
          },
        },
      ),
    });
  } catch (error) {
    console.error("Chat error:", error);
    return jsonErrorResponse(500, "Chat failed");
  }
}
