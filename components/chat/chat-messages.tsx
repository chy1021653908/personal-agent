"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "./message-bubble";
import { Loader2, Bot } from "lucide-react";
import type { UIMessage } from "ai";
import type { Source } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";

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

function getTextFromUIMessage(msg: UIMessage): string {
  return msg.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export function ChatMessages({
  messages,
  storedMessages,
  isLoading,
}: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const displayMessages: Array<{
    id: string;
    role: string;
    content: string;
    sources?: Source[] | null;
  }> =
    messages.length > 0
      ? messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: getTextFromUIMessage(m),
        }))
      : storedMessages?.filter((m) => m.role !== "system") || [];

  if (displayMessages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center space-y-4">
          <Bot className="mx-auto h-16 w-16 text-muted-foreground/30" />
          <h2 className="text-xl font-semibold text-muted-foreground">
            有什么可以帮你的？
          </h2>
          <p className="text-sm text-muted-foreground max-w-md">
            你可以直接提问，或者选择一个知识库进行基于文档的智能问答
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto max-w-3xl py-4">
        {displayMessages.map((msg) => (
          <MessageBubble
            key={msg.id}
            role={msg.role as "user" | "assistant"}
            content={msg.content}
            sources={msg.sources}
          />
        ))}
        {isLoading && (
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
            </div>
            <span className="text-sm text-muted-foreground">思考中...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
