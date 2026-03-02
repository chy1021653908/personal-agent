"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { KbSidebar } from "@/components/knowledge/kb-sidebar";
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

export default function KnowledgeBaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { knowledgeBases, createKnowledgeBase, deleteKnowledgeBase } =
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
    <div className="flex h-full">
      <KbSidebar
        knowledgeBases={knowledgeBases}
        selectedId={id}
        onSelect={(kbId) => router.push(`/knowledge/${kbId}`)}
        onCreate={async (name, description) => {
          const kb = await createKnowledgeBase(name, description);
          router.push(`/knowledge/${kb.id}`);
        }}
        onDelete={async (kbId) => {
          await deleteKnowledgeBase(kbId);
          if (kbId === id) router.push("/knowledge");
        }}
      />

      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b px-6 py-3">
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

        <div className="flex flex-1 overflow-hidden">
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
          <KbChatBar
            knowledgeBaseId={id}
            knowledgeBaseName={currentKb.name}
          />
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
