import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth-utils";
import { buildSystemPrompt, formatSourcesForMessage } from "@/lib/ai/prompts";
import { createLangChainChatModel } from "@/lib/ai/langchain-model";
import { retrieve } from "@/lib/rag/retriever";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { createAgent } from "langchain";
import type { RetrievalResult } from "@/lib/rag/retriever";

interface StreamRequestBody {
  input?: {
    messages?: IncomingMessage[];
  };
  context?: Record<string, unknown>;
  messages?: IncomingMessage[];
  conversationId?: string;
  model?: string;
  config?: {
    configurable?: {
      thread_id?: string;
    };
  };
}

interface IncomingMessage {
  role?: string;
  type?: string;
  content?: unknown;
  parts?: Array<{ type?: string; text?: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "string") return block;
        if (!isRecord(block)) return "";
        if (block.type === "text" && typeof block.text === "string") {
          return block.text;
        }
        if (typeof block.thinking === "string") {
          return block.thinking;
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

function parseIncomingMessages(body: StreamRequestBody): IncomingMessage[] {
  if (Array.isArray(body.input?.messages)) {
    return body.input.messages;
  }

  if (Array.isArray(body.messages)) {
    return body.messages;
  }

  return [];
}

function isUserLikeMessage(message: IncomingMessage): boolean {
  return message.type === "human" || message.role === "user";
}

function getLatestUserMessageText(messages: IncomingMessage[]): string {
  const latestUserMessage = [...messages].reverse().find(isUserLikeMessage);

  if (!latestUserMessage) return "";

  const direct = extractTextContent(latestUserMessage.content);
  if (direct) return direct;

  if (Array.isArray(latestUserMessage.parts)) {
    return latestUserMessage.parts
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("");
  }

  return "";
}

function resolveConversationId(body: StreamRequestBody): string | undefined {
  if (typeof body.conversationId === "string") {
    return body.conversationId;
  }

  if (typeof body.config?.configurable?.thread_id === "string") {
    return body.config.configurable.thread_id;
  }

  return undefined;
}

function resolveAssistantTextFromValues(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.messages)) {
    return null;
  }

  for (let i = payload.messages.length - 1; i >= 0; i--) {
    const rawMessage = payload.messages[i];
    if (!isRecord(rawMessage)) continue;

    const role =
      rawMessage.type === "ai"
        ? "assistant"
        : rawMessage.type === "human"
          ? "user"
          : rawMessage.role;

    if (role !== "assistant") continue;

    const content = extractTextContent(rawMessage.content);
    if (content) return content;

    if (isRecord(rawMessage.kwargs)) {
      const kwargsContent = extractTextContent(rawMessage.kwargs.content);
      if (kwargsContent) return kwargsContent;
    }
  }

  return null;
}

function parseSSEEvent(rawBlock: string): { event: string; data: unknown } | null {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of rawBlock.split(/\r?\n/)) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) return null;

  const rawData = dataLines.join("\n");
  if (!rawData || rawData === "[DONE]") return null;

  try {
    return { event, data: JSON.parse(rawData) };
  } catch {
    return { event, data: rawData };
  }
}

async function persistAssistantMessageFromStream({
  stream,
  conversationId,
  retrievalResults,
}: {
  stream: ReadableStream<Uint8Array>;
  conversationId: string;
  retrievalResults?: RetrievalResult[];
}) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assistantText = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let delimiterIndex = buffer.search(/\r?\n\r?\n/);
      while (delimiterIndex !== -1) {
        const delimiterMatch = buffer.slice(delimiterIndex).match(/^\r?\n\r?\n/);
        const delimiterLength = delimiterMatch ? delimiterMatch[0].length : 2;
        const rawBlock = buffer.slice(0, delimiterIndex);
        buffer = buffer.slice(delimiterIndex + delimiterLength);

        const parsed = parseSSEEvent(rawBlock);
        if (parsed?.event === "values" || parsed?.event.startsWith("values|")) {
          const latest = resolveAssistantTextFromValues(parsed.data);
          if (latest) assistantText = latest;
        }

        delimiterIndex = buffer.search(/\r?\n\r?\n/);
      }
    }

    if (!assistantText.trim()) return;

    await db.insert(messages).values({
      conversationId,
      role: "assistant",
      content: assistantText,
      sources:
        retrievalResults && retrievalResults.length > 0
          ? formatSourcesForMessage(retrievalResults)
          : null,
    });

    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
  } catch (error) {
    console.error("Persist assistant message failed:", error);
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = (await request.json()) as StreamRequestBody;
    const conversationId = resolveConversationId(body);

    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: "Missing conversationId" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const [conversation] = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.userId, session.user.id)
        )
      );

    if (!conversation) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const incomingMessages = parseIncomingMessages(body);
    const userContent = getLatestUserMessageText(incomingMessages).trim();
    if (!userContent) {
      return new Response(
        JSON.stringify({ error: "Missing user message" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));

    const contextModel =
      isRecord(body.context) && typeof body.context.model === "string"
        ? body.context.model
        : undefined;
    const modelName =
      typeof body.model === "string" ? body.model : contextModel;

    let retrievalResults: RetrievalResult[] | undefined;

    if (conversation.knowledgeBaseId && conversation.retrievalScope !== "none") {
      try {
        retrievalResults = await retrieve({
          knowledgeBaseId: conversation.knowledgeBaseId,
          query: userContent,
          scope:
            conversation.retrievalScope === "none"
              ? undefined
              : (conversation.retrievalScope as
                  | "knowledge_base"
                  | "folder"
                  | "document"),
          scopeId: conversation.retrievalScopeId || undefined,
        });
      } catch (error) {
        console.error("Retrieval failed:", error);
      }
    }

    await db.insert(messages).values({
      conversationId,
      role: "user",
      content: userContent,
    });

    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    const agent = createAgent({
      model: createLangChainChatModel(modelName),
      systemPrompt: buildSystemPrompt(retrievalResults),
    });

    const historyMessages = history
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content,
      }));

    const responseStream = await agent.stream(
      {
        messages: [
          ...historyMessages,
          {
            role: "user",
            content: userContent,
          },
        ],
      },
      {
        streamMode: ["values", "updates", "messages"],
        encoding: "text/event-stream",
        configurable: {
          thread_id: conversationId,
        },
      }
    );

    const [clientStream, persistStream] = responseStream.tee();
    void persistAssistantMessageFromStream({
      stream: persistStream,
      conversationId,
      retrievalResults,
    });

    return new Response(clientStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(JSON.stringify({ error: "Chat failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
