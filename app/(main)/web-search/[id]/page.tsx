import { CHAT_MODELS } from "@/lib/ai/chat-models";
import type { ChatModelProvider } from "@/lib/ai/model-provider";
import { WebSearchThreadPageClient } from "@/app/(main)/web-search/[id]/web-search-thread-page-client";
import { getWebSearchThreadMessages } from "@/lib/server/web-search-thread";

function pickSearchParam(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

export default async function WebSearchThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const modelParam = pickSearchParam(sp, "model")?.trim();
  const providerRaw = pickSearchParam(sp, "modelProvider");
  const modelProvider: ChatModelProvider | undefined =
    providerRaw === "openai" || providerRaw === "anthropic"
      ? providerRaw
      : undefined;

  const initialMessages =
    modelParam && modelProvider
      ? await getWebSearchThreadMessages(id, modelParam, modelProvider)
      : [];

  const defaultModel = CHAT_MODELS[0];

  return (
    <WebSearchThreadPageClient
      threadId={id}
      initialMessages={initialMessages}
      initialModelId={modelParam ?? defaultModel.id}
      initialModelProvider={modelProvider ?? defaultModel.modelProvider}
    />
  );
}
