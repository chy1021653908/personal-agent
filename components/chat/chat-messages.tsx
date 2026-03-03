"use client";

import { Bot } from "lucide-react";
import type { Message as StreamMessage } from "@langchain/langgraph-sdk";
import type { Source } from "@/types";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
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
import { useMemo } from "react";

interface StoredMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources?: Source[] | null;
}

interface ChatMessagesProps {
  messages: StreamMessage[];
  storedMessages?: StoredMessage[];
  isLoading: boolean;
}

type ReasoningSummaryItem = { type?: string; text?: string };

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

function extractReasoning(message: StreamMessage): string | undefined {
  if (!isRecord(message.additional_kwargs)) return undefined;

  const maybeReasoning = message.additional_kwargs.reasoning;
  if (!isRecord(maybeReasoning) || !Array.isArray(maybeReasoning.summary)) {
    return undefined;
  }

  const text = (maybeReasoning.summary as ReasoningSummaryItem[])
    .filter((item) => item.type === "summary_text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("");

  return text || undefined;
}

function extractFromStreamMessage(msg: StreamMessage): {
  text: string;
  reasoning?: string;
} {
  return {
    text: extractText(msg.content),
    reasoning: extractReasoning(msg),
  };
}

export function ChatMessages({
  messages,
  storedMessages,
  isLoading,
}: ChatMessagesProps) {
  const displayMessages = useMemo<
    Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      reasoning?: string;
      sources?: Source[] | null;
    }>
  >(
    () => {
      type DisplayMessage = {
        id: string;
        role: "user" | "assistant";
        content: string;
        reasoning?: string;
        sources?: Source[] | null;
      };

      const stored: DisplayMessage[] =
        storedMessages
          ?.filter(
            (m): m is StoredMessage & { role: "user" | "assistant" } =>
              m.role === "user" || m.role === "assistant"
          )
          .map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            sources: m.sources ?? null,
          })) ?? [];

      const live: DisplayMessage[] = messages
        .filter(
          (m): m is StreamMessage & { type: "human" | "ai" } =>
            m.type === "human" || m.type === "ai"
        )
        .map((m, index) => {
          const { text, reasoning } = extractFromStreamMessage(m);
          return {
            id: m.id ?? `live-${index}`,
            role: m.type === "human" ? "user" : "assistant",
            content: text,
            reasoning,
            sources: undefined,
          };
        });

      if (stored.length === 0) return live;
      if (live.length === 0) return stored;

      // 合并历史与新增消息，避免继续对话后“历史被覆盖不显示”
      const byId = new Map<string, DisplayMessage>();
      const order: string[] = [];

      for (const m of stored) {
        byId.set(m.id, m);
        order.push(m.id);
      }

      for (const m of live) {
        const existing = byId.get(m.id);
        if (!existing) {
          byId.set(m.id, m);
          order.push(m.id);
        } else {
          // 若同 ID 的 live 有更多信息（如 reasoning），用它补全
          byId.set(m.id, { ...existing, ...m });
        }
      }

      return order.map((id) => byId.get(id)!).filter(Boolean);
    },
    [messages, storedMessages]
  );

  if (displayMessages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="space-y-4 text-center">
          <Bot className="mx-auto h-16 w-16 text-muted-foreground/30" />
          <h2 className="text-xl font-semibold text-muted-foreground text-balance">
            有什么可以帮你的？
          </h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            你可以直接提问，或者选择一个知识库进行基于文档的智能问答
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <Conversation className="flex-1 min-h-0">
        <ConversationContent className="p-0">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 px-4 pb-12">
            {displayMessages.map((msg, idx) => {
              // 最后一条 assistant 消息且仍在流式时，Reasoning 保持展开状态
              const isLastAssistant =
                msg.role === "assistant" && idx === displayMessages.length - 1;
              const reasoningStreaming = isLoading && isLastAssistant;

              return (
                <Message from={msg.role} key={msg.id}>
                  <div className="space-y-2">
                    {msg.role === "assistant" && msg.reasoning && (
                      <Reasoning isStreaming={reasoningStreaming}>
                        <ReasoningTrigger />
                        <ReasoningContent>{msg.reasoning}</ReasoningContent>
                      </Reasoning>
                    )}
                    <MessageContent>
                      <MessageResponse>{msg.content}</MessageResponse>
                    </MessageContent>
                  </div>
                </Message>
              );
            })}
            {isLoading && (
              <Message from="assistant" key="thinking">
                <MessageContent>
                  <span
                    className="inline-flex h-2 w-2 animate-pulse rounded-full bg-foreground"
                    aria-label="思考中"
                  />
                </MessageContent>
              </Message>
            )}
          </div>
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
    </div>
  );
}
