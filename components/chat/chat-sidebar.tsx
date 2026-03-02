"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  MessageSquare,
  Plus,
  Search,
  Trash2,
  Database,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Conversation } from "@/types";
import { cn } from "@/lib/utils";

interface ChatSidebarProps {
  conversations: Conversation[];
  onNewChat: () => void;
  onDelete: (id: string) => void;
}

function groupConversations(convos: Conversation[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: { label: string; items: Conversation[] }[] = [
    { label: "今天", items: [] },
    { label: "昨天", items: [] },
    { label: "最近 7 天", items: [] },
    { label: "更早", items: [] },
  ];

  convos.forEach((c) => {
    const date = new Date(c.updatedAt);
    if (date >= today) groups[0].items.push(c);
    else if (date >= yesterday) groups[1].items.push(c);
    else if (date >= weekAgo) groups[2].items.push(c);
    else groups[3].items.push(c);
  });

  return groups.filter((g) => g.items.length > 0);
}

export function ChatSidebar({
  conversations,
  onNewChat,
  onDelete,
}: ChatSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = searchQuery
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  const groups = groupConversations(filtered);
  const currentId = pathname?.split("/chat/")[1];

  return (
    <div className="flex h-full w-64 flex-col border-r bg-sidebar">
      <div className="space-y-2 p-3">
        <Button onClick={onNewChat} className="w-full justify-start gap-2">
          <Plus className="h-4 w-4" />
          新对话
        </Button>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索对话"
            className="pl-8 h-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="flex-1 px-2">
        {groups.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
              {group.label}
            </p>
            {group.items.map((convo) => (
              <div
                key={convo.id}
                className={cn(
                  "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-sidebar-accent",
                  currentId === convo.id && "bg-sidebar-accent font-medium"
                )}
                onClick={() => router.push(`/chat/${convo.id}`)}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="truncate flex-1">{convo.title}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(convo.id);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        ))}
      </ScrollArea>

      <div className="border-t p-2">
        <Button
          variant={pathname?.startsWith("/knowledge") ? "secondary" : "ghost"}
          className="w-full justify-start gap-2"
          onClick={() => router.push("/knowledge")}
        >
          <Database className="h-4 w-4" />
          知识库
        </Button>
      </div>
    </div>
  );
}
