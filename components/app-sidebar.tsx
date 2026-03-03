"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import {
  MessageSquare,
  Plus,
  Search,
  Trash2,
  Database,
  MoreHorizontal,
  GalleryVerticalEnd,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenuAction,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Conversation } from "@/types"
import { NavUser } from "@/components/nav-user"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  conversations: Conversation[]
  onNewChat: () => void
  onDelete: (id: string) => void
}

function groupConversations(convos: Conversation[]) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)

  const groups: { label: string; items: Conversation[] }[] = [
    { label: "今天", items: [] },
    { label: "昨天", items: [] },
    { label: "最近 7 天", items: [] },
    { label: "更早", items: [] },
  ]

  convos.forEach((c) => {
    const date = new Date(c.updatedAt)
    if (date >= today) groups[0].items.push(c)
    else if (date >= yesterday) groups[1].items.push(c)
    else if (date >= weekAgo) groups[2].items.push(c)
    else groups[3].items.push(c)
  })

  return groups.filter((g) => g.items.length > 0)
}

const user = {
  name: "User",
  email: "user@example.com",
  avatar: "/avatars/user.jpg",
}

export function AppSidebar({
  conversations,
  onNewChat,
  onDelete,
  ...props
}: AppSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = React.useState("")
  const currentId = pathname?.split("/chat/")[1]

  const isChatPage = pathname?.startsWith("/chat")
  const isKnowledgePage = pathname?.startsWith("/knowledge")

  const filtered = searchQuery
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations

  const groups = groupConversations(filtered)

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
             <SidebarMenuButton
                size="lg"
                onClick={() => router.push("/chat")}
                isActive={isChatPage}
                tooltip="对话"
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <MessageSquare className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">对话</span>
                  <span className="truncate text-xs">AI 智能助手</span>
                </div>
              </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                onClick={() => router.push("/knowledge")}
                isActive={isKnowledgePage}
                tooltip="知识库"
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Database className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">知识库</span>
                  <span className="truncate text-xs">个人知识管理</span>
                </div>
              </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {isChatPage && (
          <>
            <div className="p-2 space-y-2">
              <Button onClick={onNewChat} className="w-full justify-start gap-2" variant="outline">
                <Plus className="h-4 w-4" />
                <span>新对话</span>
              </Button>
              <div className="group-data-[collapsible=icon]:hidden">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索对话"
                    className="pl-8 h-9 bg-sidebar-background"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
            {groups.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((convo) => (
                      <SidebarMenuItem key={convo.id}>
                        <SidebarMenuButton
                          onClick={() => router.push(`/chat/${convo.id}`)}
                          isActive={currentId === convo.id}
                          tooltip={convo.title}
                        >
                          <MessageSquare className="h-4 w-4" />
                          <span className="truncate">{convo.title}</span>
                        </SidebarMenuButton>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <SidebarMenuAction showOnHover>
                              <MoreHorizontal />
                              <span className="sr-only">More</span>
                            </SidebarMenuAction>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            className="w-48"
                            side="right"
                            align="start"
                          >
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                 e.stopPropagation()
                                 onDelete(convo.id)
                              }}
                            >
                              <Trash2 className="text-muted-foreground" />
                              <span>删除对话</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </>
        )}
        
        {isKnowledgePage && (
          <SidebarGroup>
            <SidebarGroupLabel>知识库管理</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-2 py-4 text-xs text-muted-foreground text-center group-data-[collapsible=icon]:hidden">
                在主界面选择知识库进行管理
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
