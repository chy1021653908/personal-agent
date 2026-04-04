import type { ChatModelProvider } from "@/lib/ai/model-provider";

const CHAT_ENTRY_REQUEST_KEY_PREFIX = "chat:entry-request:";

export type ChatEntryRequest = {
  query: string;
  kbId: string | null;
  modelId: string | null;
  modelProvider: ChatModelProvider | null;
};

const getChatEntryRequestKey = (conversationId: string) =>
  `${CHAT_ENTRY_REQUEST_KEY_PREFIX}${conversationId}`;

export function saveChatEntryRequest(
  conversationId: string,
  entryRequest: ChatEntryRequest,
) {
  sessionStorage.setItem(
    getChatEntryRequestKey(conversationId),
    JSON.stringify(entryRequest),
  );
}

export function takeChatEntryRequest(conversationId: string): ChatEntryRequest {
  const storageKey = getChatEntryRequestKey(conversationId);
  const raw = sessionStorage.getItem(storageKey);

  sessionStorage.removeItem(storageKey);

  if (!raw) {
    return {
      query: "",
      kbId: null,
      modelId: null,
      modelProvider: null,
    };
  }

  return JSON.parse(raw) as ChatEntryRequest;
}
