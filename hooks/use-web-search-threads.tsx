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
import type { WebSearchThread } from "@/types";

type WebSearchThreadsContextValue = {
  threads: WebSearchThread[];
  loading: boolean;
  upsertThread: (id: string, title?: string) => Promise<void>;
  removeThread: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const WebSearchThreadsContext =
  createContext<WebSearchThreadsContextValue | null>(null);

export function WebSearchThreadsProvider({
  children,
  initialThreads,
}: {
  children: React.ReactNode;
  initialThreads?: WebSearchThread[];
}) {
  const pathname = usePathname();
  const isWebSearchRoute = pathname?.startsWith("/web-search") ?? false;
  const [threads, setThreads] = useState<WebSearchThread[]>(
    initialThreads ?? [],
  );
  const [loading, setLoading] = useState(initialThreads === undefined);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/web-search/threads");
      if (res.ok) {
        setThreads(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch web search threads:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialThreads !== undefined) {
      setThreads(initialThreads);
      setLoading(false);
      return;
    }
    if (!isWebSearchRoute) return;
    fetchThreads();
  }, [fetchThreads, initialThreads, isWebSearchRoute]);

  const upsertThread = useCallback(async (id: string, title?: string) => {
    const res = await fetch("/api/web-search/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title }),
    });
    if (res.ok) {
      const row = (await res.json()) as WebSearchThread;
      setThreads((prev) => {
        const next = prev.filter((t) => t.id !== row.id);
        return [row, ...next].sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() -
            new Date(a.updatedAt).getTime(),
        );
      });
    }
  }, []);

  const removeThread = useCallback(async (id: string) => {
    const res = await fetch(`/api/web-search/threads/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setThreads((prev) => prev.filter((t) => t.id !== id));
    }
  }, []);

  const value = useMemo(
    () => ({
      threads,
      loading,
      upsertThread,
      removeThread,
      refresh: fetchThreads,
    }),
    [threads, loading, fetchThreads, upsertThread, removeThread],
  );

  return (
    <WebSearchThreadsContext.Provider value={value}>
      {children}
    </WebSearchThreadsContext.Provider>
  );
}

export function useWebSearchThreads() {
  const ctx = useContext(WebSearchThreadsContext);
  if (!ctx) {
    throw new Error(
      "useWebSearchThreads must be used within WebSearchThreadsProvider",
    );
  }
  return ctx;
}
