"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface KbChatBarProps {
  knowledgeBaseId: string;
  knowledgeBaseName: string;
}

export function KbChatBar({ knowledgeBaseId, knowledgeBaseName }: KbChatBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!query.trim()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: query.slice(0, 50),
          knowledgeBaseId,
          retrievalScope: "knowledge_base",
        }),
      });

      if (res.ok) {
        const convo = await res.json();
        router.push(`/chat/${convo.id}?q=${encodeURIComponent(query)}`);
      }
    } catch (error) {
      console.error("Failed to create conversation:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t bg-muted/30 p-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground shrink-0">
          基于「{knowledgeBaseName}」提问
        </span>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="输入你的问题..."
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={!query.trim() || loading}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
