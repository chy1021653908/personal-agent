"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { BreadcrumbItem, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatInput } from "@/components/chat/chat-input";
import { MainPageHeader } from "@/components/main-page-header";
import { useConversations } from "@/hooks/use-conversations";
import { useKnowledgeBases } from "@/hooks/use-knowledge-base";
import type { ChatModelProvider } from "@/lib/ai/model-provider";
import { saveChatEntryRequest } from "@/lib/chat/entry-request";
import type { KnowledgeBase } from "@/types";

export function ChatPageClient({
  initialKnowledgeBases,
}: {
  initialKnowledgeBases: KnowledgeBase[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const { createConversation } = useConversations();
  const { knowledgeBases } = useKnowledgeBases(initialKnowledgeBases);
  const [selectedKbId, setSelectedKbId] = useState<string | null>(null);

  const handleSend = async (
    content: string,
    model?: string,
    options?: { enableWebSearch?: boolean; modelProvider?: ChatModelProvider },
  ) => {
    const conversation = await createConversation(content.slice(0, 50));

    saveChatEntryRequest(conversation.id, {
      query: content,
      kbId: selectedKbId,
      modelId: model ?? null,
      modelProvider: options?.modelProvider ?? null,
    });

    router.push(`/chat/${conversation.id}`);
  };

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      <MainPageHeader>
        <BreadcrumbItem>
          <BreadcrumbPage>{t("chat.breadcrumb")}</BreadcrumbPage>
        </BreadcrumbItem>
      </MainPageHeader>
      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        <ChatMessages messages={[]} isLoading={false} />
        <div className="shrink-0">
          <ChatInput
            onSend={handleSend}
            isLoading={false}
            knowledgeBases={knowledgeBases}
            selectedKbId={selectedKbId}
            onSelectKnowledgeBase={setSelectedKbId}
            showWebSearchToggle={false}
          />
        </div>
      </div>
    </div>
  );
}
