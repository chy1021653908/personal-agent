"use client";

import { useState, useEffect, useCallback } from "react";
import type { Conversation } from "@/types";

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        setConversations(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const createConversation = async (title?: string, knowledgeBaseId?: string) => {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, knowledgeBaseId }),
    });
    if (res.ok) {
      const conversation = await res.json();
      setConversations((prev) => [conversation, ...prev]);
      return conversation;
    }
    throw new Error("Failed to create conversation");
  };

  const deleteConversation = async (id: string) => {
    const res = await fetch(`/api/conversations/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setConversations((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const updateConversation = async (
    id: string,
    data: Partial<Pick<Conversation, "title" | "retrievalScope" | "retrievalScopeId" | "knowledgeBaseId">>
  ) => {
    const res = await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = await res.json();
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? updated : c))
      );
      return updated;
    }
  };

  return {
    conversations,
    loading,
    createConversation,
    deleteConversation,
    updateConversation,
    refresh: fetchConversations,
  };
}
