"use client";

import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import type { Source } from "@/types";

interface SourceCitationProps {
  sources: Source[];
}

export function SourceCitation({ sources }: SourceCitationProps) {
  const t = useTranslations();
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      <span className="text-xs text-muted-foreground mr-1">
        {t("sourceCitation.label")}
      </span>
      {sources.map((source, i) => (
        <Tooltip key={i}>
          <TooltipTrigger asChild>
            <Badge
              variant="secondary"
              className="cursor-pointer text-xs gap-1"
            >
              <FileText className="h-3 w-3" />
              {source.fileName}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-sm">
            <p className="text-xs font-medium mb-1">{source.fileName}</p>
            <p className="text-xs text-muted-foreground line-clamp-4">
              {source.content}
            </p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
