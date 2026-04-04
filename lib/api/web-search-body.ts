/** 解析 `/api/web-search` 请求体：支持直连 `{ query }` 与 LangGraph SDK `useStream` 的 `{ input, context, config }`。 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

type StreamLikeMessage = {
  role?: string;
  type?: string;
  content?: unknown;
  parts?: Array<{ type?: string; text?: string }>;
};

function extractTextFromMessageContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "string") return block;
        if (!isRecord(block)) return "";
        if (block.type === "text" && typeof block.text === "string")
          return block.text;
        return "";
      })
      .join("");
  }
  return "";
}

function isUserLikeStreamMessage(m: StreamLikeMessage): boolean {
  const role = m.role?.toLowerCase();
  const type = m.type?.toLowerCase();
  return role === "user" || type === "human" || type === "user";
}

function getLatestUserQueryFromMessages(messages: unknown[]): string {
  const list = messages.filter((m): m is StreamLikeMessage => isRecord(m));
  const latest = [...list].reverse().find(isUserLikeStreamMessage);
  if (!latest) return "";
  const t = extractTextFromMessageContent(latest.content);
  if (t.trim()) return t.trim();
  if (Array.isArray(latest.parts)) {
    return latest.parts
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text!)
      .join("")
      .trim();
  }
  return "";
}

function parseEnableWebSearchFlag(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  return undefined;
}

export type NormalizedWebSearchBody = {
  query: string;
  model?: string;
  modelProvider?: "openai" | "anthropic";
  /** LangGraph `configurable.thread_id`；缺省则由路由生成随机 ID。 */
  checkpointThreadId?: string;
  /** 默认 false；true 时走 Tavily 规划与检索。 */
  enableWebSearch: boolean;
};

export function normalizeWebSearchRequest(
  raw: unknown,
): NormalizedWebSearchBody {
  if (!isRecord(raw)) {
    throw new Error("Invalid JSON body");
  }

  const config = isRecord(raw.config) ? raw.config : undefined;
  const configurable =
    config && isRecord(config.configurable) ? config.configurable : undefined;
  const threadFromConfig =
    configurable && typeof configurable.thread_id === "string"
      ? configurable.thread_id.trim()
      : undefined;

  if (typeof raw.query === "string" && raw.query.trim()) {
    const explicit =
      typeof raw.threadId === "string" ? raw.threadId.trim() : "";
    const merged = explicit || threadFromConfig;
    const enableWebSearch =
      parseEnableWebSearchFlag(raw.enableWebSearch) ?? false;
    return {
      query: raw.query.trim(),
      model: typeof raw.model === "string" ? raw.model.trim() : undefined,
      modelProvider: raw.modelProvider,
      checkpointThreadId: merged || undefined,
      enableWebSearch,
    };
  }

  const input = raw.input;
  const messages =
    isRecord(input) && Array.isArray(input.messages) ? input.messages : [];
  const query = getLatestUserQueryFromMessages(messages);
  if (!query) {
    throw new Error("Missing user message (input.messages)");
  }

  const context = isRecord(raw.context) ? raw.context : undefined;
  const model =
    context && typeof context.model === "string"
      ? context.model.trim()
      : undefined;
  const modelProvider = context?.modelProvider;
  const enableWebSearch =
    parseEnableWebSearchFlag(context?.enableWebSearch) ?? false;

  const explicitLegacy =
    typeof raw.threadId === "string" ? raw.threadId.trim() : "";

  const mergedThread = explicitLegacy || threadFromConfig;
  return {
    query,
    model,
    modelProvider,
    checkpointThreadId: mergedThread || undefined,
    enableWebSearch,
  };
}
