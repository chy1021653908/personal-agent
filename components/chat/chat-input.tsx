"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  isLoading,
  placeholder = "输入消息...",
}: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    onSend(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t bg-background p-4">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-xl border bg-background p-2 shadow-sm">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="min-h-[44px] max-h-[200px] resize-none border-0 shadow-none focus-visible:ring-0"
            rows={1}
          />
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
