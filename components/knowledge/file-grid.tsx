"use client";

import { MoreVertical, Trash2, Loader2, Pencil } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Document, Folder as KnowledgeFolder } from "@/types";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  ready: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
};

function formatFileSize(bytes: number | null) {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileGridProps {
  folders?: KnowledgeFolder[];
  documents: Document[];
  documentCountByFolderId?: Record<string, number>;
  onOpenFolder?: (id: string) => void;
  onRenameFolder?: (id: string, currentName: string) => void;
  onDeleteFolder?: (id: string, currentName: string) => void;
  onDelete?: (id: string, currentName: string) => void;
  onProcess?: (id: string) => void;
}

export function FileGrid({
  folders = [],
  documents,
  documentCountByFolderId,
  onOpenFolder,
  onRenameFolder,
  onDeleteFolder,
  onDelete,
  onProcess,
}: FileGridProps) {
  const t = useTranslations();
  const locale = useLocale();
  const statusLabels: Record<string, string> = {
    pending: t("knowledge.fileGrid.status.pending"),
    processing: t("knowledge.fileGrid.status.processing"),
    ready: t("knowledge.fileGrid.status.ready"),
    error: t("knowledge.fileGrid.status.error"),
  };

  if (folders.length === 0 && documents.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground h-full -mt-10">
        <div className="text-center flex flex-col items-center gap-3">
          <Image src="/kb-empty.svg" alt="file" width={80} height={80} />
          <p>{t("knowledge.fileGrid.emptyTitle")}</p>
          <p className="text-sm mt-1">{t("knowledge.fileGrid.emptyDescription")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
      {folders.map((folder) => (
        <div
          key={folder.id}
          className="h-[180px] min-w-[180px] group relative flex cursor-pointer flex-col justify-between items-center rounded-lg border p-4 text-left transition-colors hover:bg-accent/50"
          onClick={() => onOpenFolder?.(folder.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpenFolder?.(folder.id);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-7 w-7 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onRenameFolder && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onRenameFolder(folder.id, folder.name);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  {t("knowledge.fileGrid.rename")}
                </DropdownMenuItem>
              )}
              {onDeleteFolder && (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFolder(folder.id, folder.name);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("knowledge.fileGrid.delete")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Image src="/folder.svg" alt="folder" width={80} height={80} />
          <div className="w-full text-center h-full flex flex-col justify-between">
            <p className="truncate text-sm font-medium" title={folder.name}>
              {folder.name}
            </p>
            <div className="flex justify-between items-center gap-4">
              <p className="text-xs text-muted-foreground">
                {t("knowledge.fileGrid.documentCount", {
                  count: documentCountByFolderId?.[folder.id] ?? 0,
                })}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Intl.DateTimeFormat(locale).format(new Date(folder.updatedAt))}
              </p>
            </div>
          </div>
        </div>
      ))}

      {documents.map((doc) => (
        <div
          key={doc.id}
          className="group relative min-w-[180px] flex cursor-pointer flex-col items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent/50"
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-7 w-7 opacity-0 group-hover:opacity-100"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {doc.status === "pending" && onProcess && (
                <DropdownMenuItem onClick={() => onProcess(doc.id)}>
                  {t("knowledge.fileGrid.process")}
                </DropdownMenuItem>
              )}
              {doc.status === "error" && onProcess && (
                <DropdownMenuItem onClick={() => onProcess(doc.id)}>
                  {t("knowledge.fileGrid.retryProcess")}
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDelete(doc.id, doc.name)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("knowledge.fileGrid.delete")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Badge
            variant="secondary"
            className={`text-[0.65rem] absolute left-3 top-3 ${statusColors[doc.status] || ""}`}
          >
            {doc.status === "processing" && (
              <Loader2 className="h-3 w-3 animate-spin" />
            )}
            {statusLabels[doc.status] || doc.status}
          </Badge>

          <Image
            src="/file.svg"
            width={70}
            height={70}
            alt="file"
            className="text-muted-foreground"
          />
          <div className="w-full text-center h-full flex flex-col justify-between">
            <p className="truncate text-sm font-medium" title={doc.name}>
              {doc.name}
            </p>
            <div className="flex justify-between items-center gap-4">
              <p className="text-xs text-muted-foreground">
                {doc.fileType.toUpperCase()}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(doc.fileSize)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
