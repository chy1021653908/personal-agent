"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import type { Conversation } from "@/types";

type ConversationPatch = Partial<Pick<Conversation, "title">>;

type ConversationsContextValue = {
  conversations: Conversation[];
  loading: boolean;
  createConversation: (title?: string) => Promise<Conversation>;
  deleteConversation: (id: string) => Promise<void>;
  updateConversation: (
    id: string,
    data: ConversationPatch
  ) => Promise<Conversation | undefined>;
  refresh: () => Promise<void>;
};

const ConversationsContext = createContext<ConversationsContextValue | null>(
  null
);

export function ConversationsProvider({
  children,
  initialConversations,
}: {
  children: React.ReactNode;
  initialConversations?: Conversation[];
}) {
  const pathname = usePathname();
  const isChatRoute = pathname?.startsWith("/chat") ?? false;
  const [conversations, setConversations] = useState<Conversation[]>(
    initialConversations ?? [],
  );
  const [loading, setLoading] = useState(initialConversations === undefined);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
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
    if (initialConversations !== undefined) {
      setConversations(initialConversations);
      setLoading(false);
      return;
    }
    if (!isChatRoute) return;
    fetchConversations();
  }, [fetchConversations, initialConversations, isChatRoute]);

  const createConversation = async (title?: string) => {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
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

  const updateConversation = async (id: string, data: ConversationPatch) => {
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

  const value = useMemo(
    () => ({
      conversations,
      loading,
      createConversation,
      deleteConversation,
      updateConversation,
      refresh: fetchConversations,
    }),
    [conversations, loading, fetchConversations]
  );

  return (
    <ConversationsContext.Provider value={value}>
      {children}
    </ConversationsContext.Provider>
  );
}

export function useConversations() {
  const context = useContext(ConversationsContext);
  if (!context) {
    throw new Error("useConversations must be used within ConversationsProvider");
  }

  return context;
}
