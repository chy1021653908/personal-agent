"use client";

import {
  FileText,
  FileType,
  FileSpreadsheet,
  Image,
  Globe,
  File,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Document } from "@/types";

const fileTypeIcons: Record<string, React.ElementType> = {
  pdf: FileText,
  txt: FileType,
  md: FileType,
  docx: FileText,
  xlsx: FileSpreadsheet,
  image: Image,
  url: Globe,
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  ready: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  pending: "待处理",
  processing: "处理中",
  ready: "就绪",
  error: "错误",
};

function formatFileSize(bytes: number | null) {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileGridProps {
  documents: Document[];
  onDelete?: (id: string) => void;
  onProcess?: (id: string) => void;
}

export function FileGrid({ documents, onDelete, onProcess }: FileGridProps) {
  if (documents.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <div className="text-center">
          <File className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>暂无文档</p>
          <p className="text-sm mt-1">上传文件开始构建知识库</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {documents.map((doc) => {
        const Icon = fileTypeIcons[doc.fileType] || File;
        return (
          <div
            key={doc.id}
            className="group relative flex flex-col items-center gap-2 rounded-lg border p-4 hover:bg-accent/50 transition-colors"
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
                    处理文档
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => onDelete(doc.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    删除
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Icon className="h-10 w-10 text-muted-foreground" />
            <div className="w-full text-center">
              <p className="truncate text-sm font-medium" title={doc.name}>
                {doc.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(doc.fileSize)}
              </p>
            </div>
            <Badge
              variant="secondary"
              className={`text-xs ${statusColors[doc.status] || ""}`}
            >
              {statusLabels[doc.status] || doc.status}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
