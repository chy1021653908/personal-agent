import type { UIMessage } from "ai";
import type { Source } from "@/types";
import { toSource, toStoredToolSource } from "@/lib/ai/source";
import type {
  CitationSource,
  MessagePart,
  StoredDataSourceUrlPart,
  StoredDynamicToolPart,
  StoredToolPayload,
  StoredToolSource,
} from "@/lib/db/schema";

export type ChatUIDataParts = {
  "source-url": StoredDataSourceUrlPart["data"];
};

export type ChatUIMessage = UIMessage<unknown, ChatUIDataParts>;
export type ChatMessagePart = ChatUIMessage["parts"][number] | MessagePart;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createSourcesPartId(sources: CitationSource[]): string {
  const firstIndex = sources.find(
    (source) =>
      typeof source.index === "number" && Number.isInteger(source.index),
  )?.index;

  return firstIndex !== undefined ? `sources-${firstIndex}` : "sources";
}

export function parseStoredToolPayload(
  payload: unknown,
): Record<string, unknown> | undefined {
  if (isRecord(payload)) return payload;
  if (typeof payload !== "string") return undefined;

  try {
    const parsed = JSON.parse(payload);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function getStoredToolPayloadText(
  payload: unknown,
  keys: string[],
): string | undefined {
  if (typeof payload === "string") return payload.trim() || undefined;

  const record = parseStoredToolPayload(payload);
  if (!record) return undefined;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function toStoredToolSources(raw: unknown): StoredToolSource[] | undefined {
  const sources = toCitationSources(raw);
  if (!sources?.length) return undefined;

  return dedupeStoredToolSourcesByTitle(sources.map(toStoredToolSource));
}

function toCitationSources(raw: unknown): CitationSource[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const seen = new Set<string>();
  const result: CitationSource[] = [];

  for (const item of raw) {
    const source = toSource(item);
    if (!source) continue;

    const key = `${source.documentId}|${source.fileName}|${source.chunkIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);

    result.push(source);
  }

  return result.length > 0 ? result : undefined;
}

export function getStoredToolPayloadCitationSources(
  payload: unknown,
): CitationSource[] | undefined {
  const record = parseStoredToolPayload(payload);
  if (!record) return undefined;

  return toCitationSources(record.sources);
}

export function getStoredToolPayloadSources(
  payload: unknown,
): StoredToolSource[] | undefined {
  const record = parseStoredToolPayload(payload);
  if (!record) return undefined;

  return toStoredToolSources(record.sources);
}

export function dedupeStoredToolSourcesByTitle(
  sources: StoredToolSource[] | null | undefined,
): StoredToolSource[] | undefined {
  if (!sources?.length) return undefined;

  const seen = new Set<string>();
  const result: StoredToolSource[] = [];

  for (const source of sources) {
    const titleKey = source.title.trim().toLowerCase();
    if (titleKey && seen.has(titleKey)) continue;
    if (titleKey) {
      seen.add(titleKey);
    }

    result.push(source);
  }

  return result.length > 0 ? result : undefined;
}

export const buildStoredDynamicToolPart = (part: {
  toolName?: string;
  toolCallId?: string;
  state?: StoredDynamicToolPart["state"];
  input?: StoredToolPayload;
  output?: StoredToolPayload;
}): StoredDynamicToolPart | null => {
  if (!part.toolName || !part.toolCallId) return null;

  return {
    type: "dynamic-tool",
    toolName: part.toolName,
    toolCallId: part.toolCallId,
    state: part.state ?? "output-available",
    input: part.input,
    output: part.output,
  };
};

export function createTextMessageParts(text: string): MessagePart[] {
  return text.trim() ? [{ type: "text", text }] : [];
}

export function normalizeAssistantContentToParts(
  content: unknown,
): MessagePart[] {
  if (typeof content === "string") {
    return createTextMessageParts(content.trim());
  }

  if (!Array.isArray(content)) return [];

  let text = "";
  const parts: MessagePart[] = [];

  for (const block of content) {
    if (!isRecord(block)) continue;

    if (block.type === "text" && typeof block.text === "string") {
      text += block.text;
      continue;
    }

    if (block.type === "reasoning" && typeof block.reasoning === "string") {
      const reasoningText = block.reasoning.trim();
      if (!reasoningText) continue;
      parts.push({
        type: "reasoning",
        text: reasoningText,
      });
    }
  }

  if (text.trim()) {
    parts.push({ type: "text", text: text.trim() });
  }

  return parts;
}

function dedupeBy<T>(
  items: T[] | null | undefined,
  getKey: (item: T) => string | undefined,
): T[] {
  if (!items?.length) return [];
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = getKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

export function dedupeSources(sources?: Source[] | null): Source[] {
  return dedupeBy(
    sources,
    (source) => `${source.documentId}|${source.fileName}|${source.chunkIndex}`,
  );
}

export function dedupeSourcesByDocumentId(sources?: Source[] | null): Source[] {
  return dedupeBy(sources, (source) => source.documentId);
}

export function appendStoredSourcesFromCitationSources(
  raw: CitationSource[] | undefined,
  sourceCatalog: CitationSource[],
  seenCitationKeys: Set<string>,
): void {
  if (!raw?.length) return;

  for (const source of raw) {
    const key = `${source.source}:${source.index}`;
    if (seenCitationKeys.has(key)) continue;
    seenCitationKeys.add(key);
    sourceCatalog.push(source);
  }
}

export function insertStoredSourcesPart(
  parts: MessagePart[],
  sources: CitationSource[],
): MessagePart[] {
  const dataSourcePart = buildStoredDataSourceUrlPart(sources);
  if (!dataSourcePart) return parts;

  const firstRenderableIndex = parts.findIndex(
    (part) => part.type === "text" || part.type === "reasoning",
  );

  if (firstRenderableIndex < 0) {
    return [...parts, dataSourcePart];
  }

  return [
    ...parts.slice(0, firstRenderableIndex),
    dataSourcePart,
    ...parts.slice(firstRenderableIndex),
  ];
}

export function buildStoredDataSourceUrlPart(
  sources: CitationSource[],
): StoredDataSourceUrlPart | null {
  if (sources.length === 0) return null;

  const id = createSourcesPartId(sources);
  return {
    type: "data-source-url",
    id,
    data: {
      type: "source-url",
      id,
      sources,
    },
    transient: false,
  };
}
