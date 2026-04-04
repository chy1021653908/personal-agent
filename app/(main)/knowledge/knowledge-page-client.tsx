"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Calendar, Database, Plus, Trash2 } from "lucide-react";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { MainPageHeader } from "@/components/main-page-header";
import { BreadcrumbItem, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useKnowledgeBases } from "@/hooks/use-knowledge-base";
import type { KnowledgeBase } from "@/types";

export function KnowledgePageClient({
  initialKnowledgeBases,
}: {
  initialKnowledgeBases: KnowledgeBase[];
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { knowledgeBases, loading, createKnowledgeBase, deleteKnowledgeBase } =
    useKnowledgeBases(initialKnowledgeBases);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<KnowledgeBase | null>(
    null,
  );

  const handleCreate = async () => {
    if (!name.trim()) return;

    try {
      const kb = await createKnowledgeBase(name);
      setName("");
      setDialogOpen(false);
      router.push(`/knowledge/${kb.id}`);
    } catch {
      setDialogOpen(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <MainPageHeader>
        <BreadcrumbItem>
          <BreadcrumbPage>{t("knowledge.breadcrumb")}</BreadcrumbPage>
        </BreadcrumbItem>
      </MainPageHeader>
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("knowledge.page.title")}
            </h1>
            <p className="text-muted-foreground">
              {t("knowledge.page.description")}
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t("knowledge.page.createKnowledgeBase")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("knowledge.page.createDialogTitle")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>{t("knowledge.page.name")}</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("knowledge.page.namePlaceholder")}
                  />
                </div>
                <Button onClick={handleCreate} className="w-full">
                  {t("knowledge.page.create")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">{t("knowledge.page.loading")}</p>
          </div>
        ) : knowledgeBases.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] border rounded-lg border-dashed">
            <Database className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {t("knowledge.page.emptyTitle")}
            </h2>
            <p className="text-muted-foreground max-w-sm text-center mb-6">
              {t("knowledge.page.emptyDescription")}
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t("knowledge.page.createKnowledgeBase")}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-6">
            {knowledgeBases.map((kb) => (
              <Card
                key={kb.id}
                className="cursor-pointer shadow-none group relative h-[180px] min-w-[180px] flex flex-col justify-between"
                onClick={() => router.push(`/knowledge/${kb.id}`)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <Image
                        src="/kb.svg"
                        alt="kb"
                        width={60}
                        height={60}
                        className="text-muted-foreground"
                      />
                      <span className="truncate">{kb.name}</span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span>
                        {t("knowledge.page.documentCount", {
                          count: kb.documentCount || 0,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {new Intl.DateTimeFormat(locale).format(
                          new Date(kb.updatedAt),
                        )}
                      </span>
                    </div>
                  </div>
                </CardContent>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={(event) => {
                    event.stopPropagation();
                    setPendingDelete(kb);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
      <DeleteConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
        title={t("knowledge.page.deleteTitle")}
        description={
          pendingDelete
            ? t("knowledge.page.deleteDescription", {
                name: pendingDelete.name,
              })
            : ""
        }
        confirmLabel={t("knowledge.page.deleteConfirm")}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteKnowledgeBase(pendingDelete.id);
        }}
      />
    </div>
  );
}
