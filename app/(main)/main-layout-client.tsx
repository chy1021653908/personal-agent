"use client";

import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  ConversationsProvider,
  useConversations,
} from "@/hooks/use-conversations";
import {
  WebSearchThreadsProvider,
  useWebSearchThreads,
} from "@/hooks/use-web-search-threads";
import type { Conversation, WebSearchThread } from "@/types";

function MainLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { conversations, deleteConversation } = useConversations();
  const { threads: webSearchThreads, removeThread } = useWebSearchThreads();

  const handleNewChat = () => {
    router.push("/chat");
  };

  const handleNewWebSearch = () => {
    router.push("/web-search");
  };

  const handleDeleteWebSearch = async (id: string) => {
    await removeThread(id);
    if (typeof window !== "undefined" && window.location.pathname.includes(id)) {
      router.push("/web-search");
    }
  };

  const handleDelete = async (id: string) => {
    await deleteConversation(id);
    if (window.location.pathname.includes(id)) {
      router.push("/chat");
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar
        conversations={conversations}
        onNewChat={handleNewChat}
        onDelete={handleDelete}
        webSearchThreads={webSearchThreads.map((thread) => ({
          id: thread.id,
          title: thread.title,
          updatedAt: new Date(thread.updatedAt),
        }))}
        onNewWebSearch={handleNewWebSearch}
        onDeleteWebSearch={handleDeleteWebSearch}
      />
      <SidebarInset className="h-screen overflow-hidden">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}

export function MainLayoutClient({
  children,
  initialConversations,
  initialThreads,
}: {
  children: React.ReactNode;
  initialConversations: Conversation[];
  initialThreads: WebSearchThread[];
}) {
  return (
    <ConversationsProvider initialConversations={initialConversations}>
      <WebSearchThreadsProvider initialThreads={initialThreads}>
        <MainLayoutContent>{children}</MainLayoutContent>
      </WebSearchThreadsProvider>
    </ConversationsProvider>
  );
}
