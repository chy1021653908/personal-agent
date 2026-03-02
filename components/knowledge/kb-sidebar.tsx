"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Database,
  Plus,
  Trash2,
  MessageSquare,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { KnowledgeBase } from "@/types";
import { cn } from "@/lib/utils";

interface KbSidebarProps {
  knowledgeBases: KnowledgeBase[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string, description?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function KbSidebar({
  knowledgeBases,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
}: KbSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [expanded, setExpanded] = useState(true);

  const handleCreate = async () => {
    if (!name.trim()) return;
    await onCreate(name, description);
    setName("");
    setDescription("");
    setDialogOpen(false);
  };

  return (
    <div className="flex h-full w-60 flex-col border-r bg-sidebar">
      <div className="flex items-center justify-between p-4">
        <h2 className="text-sm font-semibold">知识库</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建知识库</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>名称</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="知识库名称"
                />
              </div>
              <div className="space-y-2">
                <Label>描述</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="可选描述"
                  rows={3}
                />
              </div>
              <Button onClick={handleCreate} className="w-full">
                创建
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="flex-1 px-2">
        <button
          className="flex w-full items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          个人知识库
        </button>
        {expanded &&
          knowledgeBases.map((kb) => (
            <div
              key={kb.id}
              className={cn(
                "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-sidebar-accent ml-3",
                selectedId === kb.id && "bg-sidebar-accent font-medium"
              )}
              onClick={() => onSelect(kb.id)}
            >
              <Database className="h-4 w-4 shrink-0" />
              <span className="truncate flex-1">{kb.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(kb.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
      </ScrollArea>

      <div className="border-t p-2">
        <Button
          variant={pathname?.startsWith("/chat") ? "secondary" : "ghost"}
          className="w-full justify-start gap-2"
          onClick={() => router.push("/chat")}
        >
          <MessageSquare className="h-4 w-4" />
          对话
        </Button>
      </div>
    </div>
  );
}
