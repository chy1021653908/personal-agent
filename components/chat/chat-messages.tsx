"use client";

import { Bot, Loader2 } from "lucide-react";
import type { UIMessage } from "ai";
import type { Source } from "@/types";
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
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";

interface StoredMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources?: Source[] | null;
}

interface ChatMessagesProps {
  messages: UIMessage[];
  storedMessages?: StoredMessage[];
  isLoading: boolean;
}

type UIMessagePart =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: string; [key: string]: unknown };

function extractFromUIMessage(msg: UIMessage): {
  text: string;
  reasoning?: string;
} {
  let text = "";
  let reasoning = "";

  for (const raw of msg.parts as UIMessagePart[]) {
    if (raw.type === "text") {
      text += raw.text;
    } else if (raw.type === "reasoning") {
      reasoning += raw.text;
    }
  }

  return {
    text,
    reasoning: reasoning || undefined,
  };
}

export function ChatMessages({
  messages,
  storedMessages,
  isLoading,
}: ChatMessagesProps) {
  const displayMessages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    reasoning?: string;
    sources?: Source[] | null;
  }> =
    messages.length > 0
      ? messages.map((m) => {
          const { text, reasoning } = extractFromUIMessage(m);
          return {
            id: m.id,
            role: m.role as "user" | "assistant",
            content: text,
            reasoning,
          };
        })
      : (storedMessages?.filter(
          (m): m is StoredMessage & { role: "user" | "assistant" } =>
            m.role === "user" || m.role === "assistant"
        ) ?? []);

  if (displayMessages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="space-y-4 text-center">
          <Bot className="mx-auto h-16 w-16 text-muted-foreground/30" />
          <h2 className="text-xl font-semibold text-muted-foreground">
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
    <div className="flex flex-1 flex-col">
      <Conversation>
        <ConversationContent>
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 py-4">
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
              <div className="flex items-center gap-3 px-4 py-4 text-sm text-muted-foreground">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                  <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
                </div>
                思考中...
              </div>
            )}
          </div>
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
    </div>
  );
}
