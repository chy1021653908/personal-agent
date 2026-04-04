"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { XIcon } from "lucide-react";
import { getSourceLink } from "@/lib/ai/source";
import type { Source } from "@/types";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_AVATARS = 6;

function sourceMetaLabel(
  source: Source,
  t: ReturnType<typeof useTranslations>,
): string {
  const url = getSourceLink(source);
  if (!url) {
    return source.source === "knowledge_base"
      ? t("common.document")
      : t("common.source");
  }
  try {
    return new URL(url).hostname.replace(/^www\./, "") || t("common.source");
  } catch {
    return t("common.source");
  }
}

function sourceTitle(source: Source, fallback: string): string {
  return source.title?.trim() || source.fileName?.trim() || fallback;
}

function sourceHost(source: Source): string | null {
  const url = getSourceLink(source);
  if (!url) return null;

  try {
    return new URL(url).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function getSourceFaviconUrl(source: Source): string | null {
  if (source.source !== "web") return null;

  const host = sourceHost(source);
  if (!host) return null;
  return `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(host)}`;
}

function dedupeSourcesByTitle(sources: Source[]): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];

  for (const source of sources) {
    const key = source.title?.trim().toLowerCase();
    if (key && seen.has(key)) continue;
    if (key) {
      seen.add(key);
    }
    out.push(source);
  }

  return out;
}

export function buildSourceSelectionKey(sources: Source[]): string {
  return dedupeSourcesByTitle(sources)
    .map((source) =>
      [
        source.title?.trim().toLowerCase() || "",
        source.documentId || "",
        source.sourceId || "",
        source.url || "",
        source.fileName || "",
      ].join("|"),
    )
    .join("||");
}

function defaultAvatarText(source: Source): string {
  const base = (source.fileName || source.title || "").trim();
  if (!base) return "NA";
  const noExt = base.replace(/\.[^/.]+$/, "");
  const cleaned = noExt.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "");
  if (!cleaned) return "NA";
  return cleaned.slice(0, 2).toUpperCase();
}

export function SourceReferencesSheet({
  sources,
  getAvatarText,
  isActive = false,
  onToggle,
}: {
  sources: Source[];
  getAvatarText?: (source: Source) => string;
  isActive?: boolean;
  onToggle: (sources: Source[], key: string) => void;
}) {
  const t = useTranslations();
  const uniqueSources = useMemo(() => dedupeSourcesByTitle(sources), [sources]);
  const selectionKey = useMemo(
    () => buildSourceSelectionKey(uniqueSources),
    [uniqueSources],
  );

  if (uniqueSources.length === 0) return null;

  const visible = uniqueSources.slice(0, MAX_AVATARS);
  const overflow = uniqueSources.length - MAX_AVATARS;

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-pressed={isActive}
      onClick={() => onToggle(uniqueSources, selectionKey)}
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 rounded-full py-0.5 text-xs text-muted-foreground hover:bg-source-references-hover hover:text-muted-foreground",
        isActive ? "bg-source-references-hover" : "",
      )}
    >
      <AvatarGroup className="items-center -space-x-0.5 *:data-[slot=avatar]:ring-1">
        {visible.map((source) => {
          const avatarUrl = getSourceFaviconUrl(source);

          return (
            <Avatar
              key={`${source.documentId}-${source.index}-${source.title}`}
              size="xs"
            >
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
              <AvatarFallback>
                {getAvatarText?.(source) ?? defaultAvatarText(source)}
              </AvatarFallback>
            </Avatar>
          );
        })}
        {overflow > 0 ? (
          <AvatarGroupCount className="ring-1">+{overflow}</AvatarGroupCount>
        ) : null}
      </AvatarGroup>
      <span>{t("common.references")}</span>
    </Button>
  );
}

export function SourceReferencesSidePanel({
  open,
  sources,
  onClose,
}: {
  open: boolean;
  sources: Source[];
  onClose: () => void;
}) {
  const t = useTranslations();

  return (
    <aside
      className={cn(
        "min-h-0 shrink-0 overflow-hidden bg-background transition-[width,max-height,opacity,border-color] duration-300 ease-out",
        "flex flex-col",
        open
          ? "w-full max-h-[55vh] border-t opacity-100 lg:w-[490px] lg:max-h-none lg:border-t-0 lg:border-l"
          : "w-full max-h-0 border-transparent opacity-0 lg:w-0 lg:max-h-none",
      )}
      aria-hidden={!open}
    >
      <div className="flex items-center justify-between px-4 pt-2">
        <h3 className="text-sm font-semibold">{t("common.references")}</h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onClose}
        >
          <XIcon />
          <span className="sr-only">Close</span>
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {sources.map((source, index) => {
          const link = getSourceLink(source);
          const title = sourceTitle(
            source,
            `${t("common.source")} ${index + 1}`,
          );
          const host = sourceHost(source);
          const faviconUrl = getSourceFaviconUrl(source);
          const faviconFallbackBase =
            source.source === "web" ? host || title : title;
          const faviconFallback = faviconFallbackBase
            .slice(0, 1)
            .toUpperCase();
          const itemClass = cn(
            "flex min-w-0 gap-2.5 rounded-[12px] bg-muted/35 p-2 transition-colors hover:bg-source-references-item-hover",
          );
          const meta = sourceMetaLabel(source, t);
          const body = (
            <>
              <div className="translate-y-0.5">
                <div className="relative flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-full">
                  {faviconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      aria-hidden
                      alt=""
                      src={faviconUrl}
                      width={16}
                      height={16}
                      className="relative block size-4"
                    />
                  ) : (
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {faviconFallback}
                    </span>
                  )}
                  <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-black/10 dark:ring-transparent" />
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex min-w-0 flex-col text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="line-clamp-1 text-xs text-muted-foreground">
                      {meta}
                    </span>
                  </div>
                  <span className="line-clamp-2 font-medium text-foreground">
                    {title}
                  </span>
                  {source.content?.trim() ? (
                    <span className="line-clamp-4 wrap-break-word text-muted-foreground">
                      {source.content}
                    </span>
                  ) : null}
                </div>
              </div>
            </>
          );

          if (link) {
            return (
              <a
                key={`${title}-${index}`}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className={itemClass}
              >
                {body}
              </a>
            );
          }

          return (
            <div key={`${title}-${index}`} className={itemClass}>
              {body}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
