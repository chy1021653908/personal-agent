"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FolderTree } from "@/components/knowledge/folder-tree";
import { FileGrid } from "@/components/knowledge/file-grid";
import { FileUploadDialog } from "@/components/knowledge/file-upload-dialog";
import { KbChatBar } from "@/components/knowledge/kb-chat-bar";
import {
  useKnowledgeBases,
  useFolders,
  useDocuments,
} from "@/hooks/use-knowledge-base";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function KnowledgeBaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { knowledgeBases } =
    useKnowledgeBases();
  const { folders, createFolder } = useFolders(id);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const { documents, uploadDocument, refresh: refreshDocs } = useDocuments(
    id,
    selectedFolderId
  );
  const [uploadOpen, setUploadOpen] = useState(false);

  const currentKb = knowledgeBases.find((kb) => kb.id === id);

  const handleProcessDocument = async (docId: string) => {
    try {
      toast.info("开始处理文档...");
      const res = await fetch("/api/rag/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: docId }),
      });

      if (res.ok) {
        toast.success("文档处理完成");
        refreshDocs();
      } else {
        toast.error("文档处理失败");
      }
    } catch {
      toast.error("文档处理失败");
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    try {
      const res = await fetch(`/api/knowledge/${id}/documents/${docId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("文档已删除");
        refreshDocs();
      }
    } catch {
      toast.error("删除失败");
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/knowledge">知识库</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{currentKb?.name || "加载中..."}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        <div className="flex items-center justify-between border-b px-6 py-3 shrink-0">
          <div>
            <h1 className="text-lg font-semibold">
              {currentKb?.name || "知识库"}
            </h1>
            {currentKb?.description && (
              <p className="text-sm text-muted-foreground">
                {currentKb.description}
              </p>
            )}
          </div>
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            上传文档
          </Button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="w-48 border-r p-3 overflow-auto">
            <FolderTree
              folders={folders}
              selectedFolderId={selectedFolderId}
              onSelect={setSelectedFolderId}
              onCreate={async (name, parentFolderId) => {
                await createFolder(name, parentFolderId);
              }}
            />
          </div>

          <div className="flex-1 overflow-auto p-6">
            <FileGrid
              documents={documents}
              onDelete={handleDeleteDocument}
              onProcess={handleProcessDocument}
            />
          </div>
        </div>

        {currentKb && (
          <div className="shrink-0">
             <KbChatBar
                knowledgeBaseId={id}
                knowledgeBaseName={currentKb.name}
             />
          </div>
        )}
      </div>

      <FileUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUpload={async (file) => {
          await uploadDocument(file, selectedFolderId || undefined);
          toast.success(`${file.name} 上传成功`);
        }}
      />
    </div>
  );
}
