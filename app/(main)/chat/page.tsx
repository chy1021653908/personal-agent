"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatInput } from "@/components/chat/chat-input";
import { ScopeSelector } from "@/components/knowledge/scope-selector";
import { useConversations } from "@/hooks/use-conversations";
import { useKnowledgeBases } from "@/hooks/use-knowledge-base";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChatPage() {
  const router = useRouter();
  const {
    createConversation,
  } = useConversations();
  const { knowledgeBases } = useKnowledgeBases();
  const [selectedKbId, setSelectedKbId] = useState<string | null>(null);

  const handleSend = async (content: string, _model?: string) => {
    const convo = await createConversation(
      content.slice(0, 50),
      selectedKbId || undefined
    );
    router.push(`/chat/${convo.id}?q=${encodeURIComponent(content)}`);
  };

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Chat</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        <ChatMessages messages={[]} isLoading={false} />
        <div className="px-4 pb-1 shrink-0">
          <div className="mx-auto max-w-3xl">
            <ScopeSelector
              knowledgeBases={knowledgeBases}
              selectedKbId={selectedKbId}
              onSelect={setSelectedKbId}
            />
          </div>
        </div>
        <div className="shrink-0">
          <ChatInput onSend={handleSend} isLoading={false} />
        </div>
      </div>
    </div>
  );
}
