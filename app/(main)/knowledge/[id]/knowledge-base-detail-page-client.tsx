"use client";

import { useMemo, useState } from "react";
import { FolderPlus, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { MainPageHeader } from "@/components/main-page-header";
import { FolderTree } from "@/components/knowledge/folder-tree";
import { FileGrid } from "@/components/knowledge/file-grid";
import { FileUploadDialog } from "@/components/knowledge/file-upload-dialog";
import { Button } from "@/components/ui/button";
import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useDocuments,
  useFolders,
  useKnowledgeBases,
} from "@/hooks/use-knowledge-base";
import type { Document, Folder, KnowledgeBase } from "@/types";

export function KnowledgeBaseDetailPageClient({
  knowledgeBaseId,
  initialKnowledgeBases,
  initialFolders,
  initialDocuments,
}: {
  knowledgeBaseId: string;
  initialKnowledgeBases: KnowledgeBase[];
  initialFolders: Folder[];
  initialDocuments: Document[];
}) {
  const t = useTranslations();
  const { knowledgeBases } = useKnowledgeBases(initialKnowledgeBases);
  const { folders, createFolder, renameFolder, deleteFolder } = useFolders(
    knowledgeBaseId,
    initialFolders,
  );
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const {
    documents: allDocuments,
    uploadDocument,
    triggerDocumentIndexing,
    refresh: refreshDocs,
  } = useDocuments(knowledgeBaseId, undefined, initialDocuments);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [pendingFolderDelete, setPendingFolderDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [pendingDocumentDelete, setPendingDocumentDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const currentKb = knowledgeBases.find((kb) => kb.id === knowledgeBaseId);

  const documents = useMemo(
    () => allDocuments.filter((doc) => doc.folderId === selectedFolderId),
    [allDocuments, selectedFolderId],
  );

  const childFolders = useMemo(
    () =>
      folders.filter((folder) => folder.parentFolderId === selectedFolderId),
    [folders, selectedFolderId],
  );

  const documentCountByFolderId = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const doc of allDocuments) {
      if (!doc.folderId) continue;
      counts[doc.folderId] = (counts[doc.folderId] ?? 0) + 1;
    }

    return counts;
  }, [allDocuments]);

  const handleProcessDocument = async (docId: string) => {
    try {
      await triggerDocumentIndexing(docId);
      toast.info(t("knowledge.detail.toasts.processStarted"));
    } catch {
      toast.error(t("knowledge.detail.toasts.processFailed"));
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    try {
      const res = await fetch(
        `/api/knowledge/${knowledgeBaseId}/documents/${docId}`,
        {
          method: "DELETE",
        },
      );
      if (res.ok) {
        toast.success(t("knowledge.detail.toasts.documentDeleted"));
        refreshDocs();
      }
    } catch {
      toast.error(t("knowledge.detail.toasts.deleteFailed"));
    }
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      return;
    }

    try {
      await createFolder(name, selectedFolderId ?? undefined);
      toast.success(t("knowledge.detail.toasts.folderCreated"));
      setNewFolderName("");
      setCreateFolderDialogOpen(false);
    } catch {
      toast.error(t("knowledge.detail.toasts.createFolderFailed"));
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <MainPageHeader>
        <BreadcrumbItem>
          <BreadcrumbLink href="/knowledge">
            {t("knowledge.breadcrumb")}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>
            {currentKb?.name || t("knowledge.detail.loadingName")}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </MainPageHeader>

      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        <div className="flex items-center justify-between border-b px-6 py-3 shrink-0">
          <div>
            <h1 className="text-lg font-semibold">
              {currentKb?.name || t("knowledge.detail.fallbackName")}
            </h1>
            {currentKb?.description && (
              <p className="text-sm text-muted-foreground">
                {currentKb.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateFolderDialogOpen(true)}
            >
              <FolderPlus className="mr-2 h-4 w-4" />
              {t("knowledge.detail.createFolder")}
            </Button>
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              {t("knowledge.detail.uploadDocument")}
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="w-48 border-r p-3 overflow-auto">
            <FolderTree
              folders={folders}
              documentCountByFolderId={documentCountByFolderId}
              rootName={currentKb?.name || t("knowledge.detail.fallbackName")}
              totalDocumentCount={allDocuments.length}
              selectedFolderId={selectedFolderId}
              onSelect={setSelectedFolderId}
            />
          </div>

          <div className="flex-1 overflow-auto p-6">
            <FileGrid
              folders={childFolders}
              documents={documents}
              onOpenFolder={setSelectedFolderId}
              onRenameFolder={(folderId, currentName) => {
                const nextName = window
                  .prompt(t("knowledge.detail.renameFolderPrompt"), currentName)
                  ?.trim();

                if (!nextName || nextName === currentName) {
                  return;
                }

                void renameFolder(folderId, nextName)
                  .then(() => toast.success(t("knowledge.detail.toasts.folderRenamed")))
                  .catch(() => toast.error(t("knowledge.detail.toasts.renameFailed")));
              }}
              onDeleteFolder={(folderId, currentName) => {
                setPendingFolderDelete({ id: folderId, name: currentName });
              }}
              documentCountByFolderId={documentCountByFolderId}
              onDelete={(docId, currentName) => {
                setPendingDocumentDelete({ id: docId, name: currentName });
              }}
              onProcess={handleProcessDocument}
            />
          </div>
        </div>
      </div>

      <FileUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUpload={async (file) => {
          await uploadDocument(file, selectedFolderId || undefined);
          toast.success(t("knowledge.detail.toasts.uploadSuccess", { name: file.name }));
        }}
      />
      <Dialog
        open={createFolderDialogOpen}
        onOpenChange={(open) => {
          setCreateFolderDialogOpen(open);
          if (!open) {
            setNewFolderName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("knowledge.detail.createFolderDialog.title")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="folder-name">
                {t("knowledge.detail.createFolderDialog.name")}
              </Label>
              <Input
                id="folder-name"
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                placeholder={t("knowledge.detail.createFolderDialog.namePlaceholder")}
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleCreateFolder();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateFolderDialogOpen(false)}
            >
              {t("knowledge.detail.createFolderDialog.cancel")}
            </Button>
            <Button type="button" onClick={() => void handleCreateFolder()}>
              {t("knowledge.detail.createFolderDialog.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DeleteConfirmDialog
        open={pendingFolderDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingFolderDelete(null);
          }
        }}
        title={t("knowledge.detail.deleteFolder.title")}
        description={
          pendingFolderDelete
            ? t("knowledge.detail.deleteFolder.description", {
                name: pendingFolderDelete.name,
              })
            : ""
        }
        confirmLabel={t("knowledge.detail.deleteFolder.confirm")}
        onConfirm={async () => {
          if (!pendingFolderDelete) return;
          await deleteFolder(pendingFolderDelete.id);
          toast.success(t("knowledge.detail.toasts.folderDeleted"));
          refreshDocs();
        }}
      />
      <DeleteConfirmDialog
        open={pendingDocumentDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDocumentDelete(null);
          }
        }}
        title={t("knowledge.detail.deleteDocument.title")}
        description={
          pendingDocumentDelete
            ? t("knowledge.detail.deleteDocument.description", {
                name: pendingDocumentDelete.name,
              })
            : ""
        }
        confirmLabel={t("knowledge.detail.deleteDocument.confirm")}
        onConfirm={async () => {
          if (!pendingDocumentDelete) return;
          await handleDeleteDocument(pendingDocumentDelete.id);
        }}
      />
    </div>
  );
}
