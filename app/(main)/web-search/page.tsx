"use client";

import { BreadcrumbItem, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatInput } from "@/components/chat/chat-input";
import { MainPageHeader } from "@/components/main-page-header";
import { useWebSearchThreads } from "@/hooks/use-web-search-threads";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function WebSearchLandingPage() {
  const t = useTranslations();
  const router = useRouter();
  const { upsertThread } = useWebSearchThreads();

  const handleSend = async (
    content: string,
    model?: string,
    options?: { enableWebSearch?: boolean; modelProvider?: "openai" | "anthropic" },
  ) => {
    const m = model?.trim();
    const p = options?.modelProvider;
    if (!m || !p) return;

    const id = crypto.randomUUID();
    const q = content.trim();
    const enableWebSearch = options?.enableWebSearch ?? false;
    await upsertThread(id, q.slice(0, 80) || t("webSearch.untitledThread"));
    const params = new URLSearchParams({ q, model: m, modelProvider: p });
    if (enableWebSearch) {
      params.set("ws", "1");
    }
    router.push(`/web-search/${id}?${params.toString()}`);
  };

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      <MainPageHeader>
        <BreadcrumbItem>
          <BreadcrumbPage>{t("webSearch.breadcrumb")}</BreadcrumbPage>
        </BreadcrumbItem>
      </MainPageHeader>
      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        <ChatMessages messages={[]} isLoading={false} />
        <div className="shrink-0">
          <ChatInput
            onSend={handleSend}
            isLoading={false}
            knowledgeBases={[]}
            selectedKbId={null}
            onSelectKnowledgeBase={() => {}}
            placeholder={t("webSearch.landingPlaceholder")}
            showKnowledgeBase={false}
          />
        </div>
      </div>
    </div>
  );
}
