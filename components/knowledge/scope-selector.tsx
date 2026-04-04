"use client";

import { Database, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { KnowledgeBase } from "@/types";

interface ScopeSelectorProps {
  knowledgeBases: KnowledgeBase[];
  selectedKbId: string | null;
  onSelect: (kbId: string | null) => void;
}

export function ScopeSelector({
  knowledgeBases,
  selectedKbId,
  onSelect,
}: ScopeSelectorProps) {
  const t = useTranslations();
  const selectedKb = knowledgeBases.find((kb) => kb.id === selectedKbId);

  return (
    <div className="flex items-center gap-2">
      {selectedKb ? (
        <Badge
          variant="secondary"
          className="gap-1 py-1 px-2 cursor-pointer"
        >
          <Database className="h-3 w-3" />
          <span className="text-xs">{selectedKb.name}</span>
          <button
            onClick={() => onSelect(null)}
            className="ml-1 hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground gap-1"
            >
              <Database className="h-3.5 w-3.5" />
              {t("knowledge.breadcrumb")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel className="text-xs">
              {t("chat.input.knowledgeBases")}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {knowledgeBases.length === 0 ? (
              <DropdownMenuItem disabled>
                {t("chat.input.emptyKnowledgeBase")}
              </DropdownMenuItem>
            ) : (
              knowledgeBases.map((kb) => (
                <DropdownMenuItem
                  key={kb.id}
                  onClick={() => onSelect(kb.id)}
                  className="gap-2"
                >
                  <Database className="h-4 w-4" />
                  {kb.name}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
