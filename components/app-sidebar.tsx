"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  MessageSquare,
  Database,
  GitBranch,
  Plus,
  Search,
  Trash2,
  MoreHorizontal,
} from "lucide-react";

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
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { Input } from "@/components/ui/input";
import type { Conversation } from "@/types";
import { CHAT_MODELS } from "@/lib/ai/chat-models";
import { NavUser } from "@/components/nav-user";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useSession } from "@/lib/auth-client";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  conversations?: Conversation[];
  onNewChat?: () => void;
  onDelete?: (id: string) => void | Promise<void>;
  webSearchThreads?: { id: string; title: string; updatedAt: Date }[];
  onNewWebSearch?: () => void;
  onDeleteWebSearch?: (id: string) => void | Promise<void>;
}

type RecencyLabels = {
  today: string;
  yesterday: string;
  last7Days: string;
  older: string;
};

function groupByRecency<T extends { updatedAt: Date }>(
  items: T[],
  labels: RecencyLabels,
): { label: string; items: T[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: { label: string; items: T[] }[] = [
    { label: labels.today, items: [] },
    { label: labels.yesterday, items: [] },
    { label: labels.last7Days, items: [] },
    { label: labels.older, items: [] },
  ];

  items.forEach((c) => {
    const date = new Date(c.updatedAt);
    if (date >= today) groups[0].items.push(c);
    else if (date >= yesterday) groups[1].items.push(c);
    else if (date >= weekAgo) groups[2].items.push(c);
    else groups[3].items.push(c);
  });

  return groups.filter((g) => g.items.length > 0);
}

function groupConversations(convos: Conversation[], labels: RecencyLabels) {
  return groupByRecency(
    convos.map((c) => ({
      ...c,
      updatedAt: new Date(c.updatedAt),
    })),
    labels,
  );
}

export function AppSidebar({
  conversations = [],
  onNewChat = () => {},
  onDelete = () => {},
  webSearchThreads = [],
  onNewWebSearch = () => {},
  onDeleteWebSearch = () => {},
  ...props
}: AppSidebarProps) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [searchQuery, setSearchQuery] = React.useState("");
  const [webSearchQuery, setWebSearchQuery] = React.useState("");
  const [pendingConversationDelete, setPendingConversationDelete] =
    React.useState<{ id: string; title: string } | null>(null);
  const [pendingWebSearchDelete, setPendingWebSearchDelete] = React.useState<{
    id: string;
    title: string;
  } | null>(null);
  const currentId = pathname?.split("/chat/")[1];
  const currentWebSearchId =
    pathname?.split("/web-search/")[1]?.trim() || undefined;

  const isChatPage = pathname?.startsWith("/chat");
  const isKnowledgePage = pathname?.startsWith("/knowledge");
  const isWebSearchPage = pathname?.startsWith("/web-search");

  const filtered = searchQuery
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : conversations;

  const recencyLabels = React.useMemo(
    () => ({
      today: t("sidebar.group.today"),
      yesterday: t("sidebar.group.yesterday"),
      last7Days: t("sidebar.group.last7Days"),
      older: t("sidebar.group.older"),
    }),
    [t],
  );
  const groups = groupConversations(filtered, recencyLabels);

  const filteredWebThreads = webSearchQuery
    ? webSearchThreads.filter((t) =>
        t.title.toLowerCase().includes(webSearchQuery.toLowerCase()),
      )
    : webSearchThreads;

  const webSearchGroups = groupByRecency(filteredWebThreads, recencyLabels);

  const sessionUser = session?.user;
  const navUser = {
    name: sessionUser?.name?.trim()
      ? sessionUser.name
      : isPending
        ? t("common.loading")
        : sessionUser?.email?.trim()
          ? sessionUser.email
          : t("common.user"),
    email: sessionUser?.email ?? (isPending ? "" : t("common.placeholderEmail")),
    avatar: sessionUser?.image?.trim() ? sessionUser.image : "",
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="rounded-[12px] bg-sidebar-accent/70 p-1 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0">
          <button
            type="button"
            onClick={() => router.push("/chat")}
            title={t("sidebar.nav.chat")}
            className={`flex h-8 w-full items-center gap-3 rounded-[8px] px-3 text-left transition-colors group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 ${
              isChatPage
                ? "bg-background text-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
            }`}
          >
            <MessageSquare className="size-4 shrink-0" />
            <span className="truncate text-sm leading-none group-data-[collapsible=icon]:hidden">
              {t("sidebar.nav.chat")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/knowledge")}
            title={t("sidebar.nav.knowledgeBase")}
            className={`mt-1 flex h-8 w-full items-center gap-3 rounded-[8px] px-3 text-left transition-colors group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 ${
              isKnowledgePage
                ? "bg-background text-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
            }`}
          >
            <Database className="size-4 shrink-0" />
            <span className="truncate text-sm leading-none group-data-[collapsible=icon]:hidden">
              {t("sidebar.nav.knowledgeBase")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/web-search")}
            title={t("sidebar.nav.webSearch")}
            className={`mt-1 flex h-8 w-full items-center gap-3 rounded-[8px] px-3 text-left transition-colors group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 ${
              isWebSearchPage
                ? "bg-background text-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
            }`}
          >
            <GitBranch className="size-4 shrink-0" />
            <span className="truncate text-sm leading-none group-data-[collapsible=icon]:hidden">
              {t("sidebar.nav.webSearch")}
            </span>
          </button>
        </div>
        {isChatPage && (
          <div className="space-y-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={onNewChat}
                  tooltip={t("sidebar.actions.newChat")}
                  className="w-full px-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"
                >
                  <div className="flex mx-0.5 aspect-square size-5 items-center justify-center rounded-full bg-primary text-primary-foreground group-data-[collapsible=icon]:mx-0 group-data-[collapsible=icon]:size-5">
                    <Plus className="size-4" />
                  </div>
                  <span className="truncate group-data-[collapsible=icon]:hidden">
                    {t("sidebar.actions.newChat")}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            <div className="group-data-[collapsible=icon]:hidden">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("sidebar.actions.searchChat")}
                  className="pl-8 h-9 bg-sidebar-background"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
        {isWebSearchPage && (
          <div className="space-y-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={onNewWebSearch}
                  tooltip={t("sidebar.actions.newWebSearch")}
                  className="w-full px-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"
                >
                  <div className="flex mx-0.5 aspect-square size-5 items-center justify-center rounded-full bg-primary text-primary-foreground group-data-[collapsible=icon]:mx-0 group-data-[collapsible=icon]:size-5">
                    <Plus className="size-4" />
                  </div>
                  <span className="truncate group-data-[collapsible=icon]:hidden">
                    {t("sidebar.actions.newWebSearch")}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            <div className="group-data-[collapsible=icon]:hidden">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("sidebar.actions.searchWebSearch")}
                  className="pl-8 h-9 bg-sidebar-background"
                  value={webSearchQuery}
                  onChange={(e) => setWebSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {isChatPage && (
          <>
            {!isCollapsed &&
              groups.map((group) => (
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
                            <span className="truncate">{convo.title}</span>
                          </SidebarMenuButton>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <SidebarMenuAction showOnHover>
                                <MoreHorizontal />
                                <span className="sr-only">
                                  {t("sidebar.actions.more")}
                                </span>
                              </SidebarMenuAction>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="right" align="start">
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPendingConversationDelete({
                                    id: convo.id,
                                    title: convo.title,
                                  });
                                }}
                              >
                                <Trash2 className="text-muted-foreground" />
                                <span>{t("sidebar.menu.deleteConversation")}</span>
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

        {isWebSearchPage && (
          <>
            {!isCollapsed &&
              webSearchGroups.map((group) => (
                <SidebarGroup key={group.label}>
                  <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((thread) => (
                        <SidebarMenuItem key={thread.id}>
                          <SidebarMenuButton
                            onClick={() => {
                              const d = CHAT_MODELS[0];
                              const qs = new URLSearchParams({
                                model: d.id,
                                modelProvider: d.modelProvider,
                              });
                              router.push(
                                `/web-search/${thread.id}?${qs.toString()}`,
                              );
                            }}
                            isActive={currentWebSearchId === thread.id}
                            tooltip={thread.title}
                          >
                            <span className="truncate">{thread.title}</span>
                          </SidebarMenuButton>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <SidebarMenuAction showOnHover>
                                <MoreHorizontal />
                                <span className="sr-only">
                                  {t("sidebar.actions.more")}
                                </span>
                              </SidebarMenuAction>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="right" align="start">
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPendingWebSearchDelete({
                                    id: thread.id,
                                    title: thread.title,
                                  });
                                }}
                              >
                                <Trash2 className="text-muted-foreground" />
                                <span>{t("sidebar.menu.deleteRecord")}</span>
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
      </SidebarContent>

      <SidebarFooter>
        <div className="px-1">
          <LanguageSwitcher
            iconOnly={isCollapsed}
            className={isCollapsed ? "" : "w-full justify-start"}
          />
        </div>
        <NavUser user={navUser} />
      </SidebarFooter>

      <DeleteConfirmDialog
        open={pendingConversationDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingConversationDelete(null);
          }
        }}
        title={t("sidebar.confirm.deleteConversationTitle")}
        description={
          pendingConversationDelete
            ? t("sidebar.confirm.deleteConversationDescription", {
                title: pendingConversationDelete.title,
              })
            : ""
        }
        confirmLabel={t("sidebar.confirm.deleteConversationConfirm")}
        onConfirm={async () => {
          if (!pendingConversationDelete) return;
          await onDelete(pendingConversationDelete.id);
        }}
      />
      <DeleteConfirmDialog
        open={pendingWebSearchDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingWebSearchDelete(null);
          }
        }}
        title={t("sidebar.confirm.deleteWebSearchTitle")}
        description={
          pendingWebSearchDelete
            ? t("sidebar.confirm.deleteWebSearchDescription", {
                title: pendingWebSearchDelete.title,
              })
            : ""
        }
        confirmLabel={t("sidebar.confirm.deleteWebSearchConfirm")}
        onConfirm={async () => {
          if (!pendingWebSearchDelete) return;
          await onDeleteWebSearch(pendingWebSearchDelete.id);
        }}
      />
    </Sidebar>
  );
}
