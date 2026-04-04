import type {
  CitationSource,
  StoredToolSource,
} from "@/lib/db/schema";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function getUrlDomain(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./i, "") || undefined;
  } catch {
    return undefined;
  }
}

export function toSource(raw: unknown): CitationSource | null {
  if (!isRecord(raw)) return null;

  const source =
    raw.source === "knowledge_base" || raw.source === "web"
      ? raw.source
      : undefined;
  const index = readInteger(raw.index);
  if (index === undefined) return null;
  if (!source) return null;

  const documentId =
    readString(raw.documentId) ??
    readString(raw.url) ??
    readString(raw.title);
  if (!documentId) return null;

  const fileName = readString(raw.fileName) ?? readString(raw.title);
  if (!fileName) return null;

  const content =
    typeof raw.content === "string"
      ? raw.content
      : typeof raw.citedText === "string"
        ? raw.citedText
        : "";

  return {
    source,
    index,
    sourceId: readString(raw.sourceId) ?? `${source}:${index}`,
    url: readString(raw.url) ?? "",
    title: readString(raw.title) ?? fileName,
    citedText: typeof raw.citedText === "string" ? raw.citedText : content,
    documentId,
    fileName,
    chunkIndex: readInteger(raw.chunkIndex) ?? 0,
    content,
  };
}

export function createCitationSource(args: {
  source: CitationSource["source"];
  index: number;
  documentId: string;
  fileName: string;
  chunkIndex?: number;
  content?: string;
  sourceId?: string;
  url?: string;
}): CitationSource {
  const documentId = args.documentId.trim();
  const fileName = args.fileName.trim() || documentId;
  const content = (args.content ?? "").trim();

  return {
    source: args.source,
    index: args.index,
    sourceId: args.sourceId ?? `${args.source}:${args.index}`,
    url: args.url?.trim() ?? (args.source === "web" ? documentId : ""),
    title: fileName,
    citedText: content,
    documentId,
    fileName,
    chunkIndex: args.chunkIndex ?? 0,
    content,
  };
}

export function getSourceLink(
  source: Pick<CitationSource, "source" | "documentId" | "url">,
): string | undefined {
  if (source.source === "web") {
    return readString(source.url) ?? readString(source.documentId);
  }

  const explicitUrl = readString(source.url);
  if (explicitUrl && /^https?:\/\//i.test(explicitUrl)) {
    return explicitUrl;
  }

  const documentId = readString(source.documentId);
  return documentId && /^https?:\/\//i.test(documentId)
    ? documentId
    : undefined;
}

export function toStoredToolSource(source: CitationSource): StoredToolSource {
  const url = getSourceLink(source);

  return {
    index: source.index,
    source: source.source,
    sourceId: source.sourceId,
    title: source.fileName,
    url,
    domain:
      source.source === "knowledge_base"
        ? "document"
        : getUrlDomain(url ?? source.documentId) ?? "网页",
    citedText: source.content || undefined,
    documentId: source.documentId,
    chunkIndex: source.chunkIndex,
  };
}
