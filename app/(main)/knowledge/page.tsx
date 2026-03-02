"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KbSidebar } from "@/components/knowledge/kb-sidebar";
import { useKnowledgeBases } from "@/hooks/use-knowledge-base";
import { Database, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function KnowledgePage() {
  const router = useRouter();
  const { knowledgeBases, loading, createKnowledgeBase, deleteKnowledgeBase } =
    useKnowledgeBases();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    router.push(`/knowledge/${id}`);
  };

  return (
    <div className="flex h-full">
      <KbSidebar
        knowledgeBases={knowledgeBases}
        selectedId={selectedId}
        onSelect={handleSelect}
        onCreate={async (name, description) => {
          const kb = await createKnowledgeBase(name, description);
          setSelectedId(kb.id);
          router.push(`/knowledge/${kb.id}`);
        }}
        onDelete={async (id) => {
          await deleteKnowledgeBase(id);
          if (selectedId === id) setSelectedId(null);
        }}
      />
      <div className="flex flex-1 items-center justify-center">
        {loading ? (
          <p className="text-muted-foreground">加载中...</p>
        ) : knowledgeBases.length === 0 ? (
          <div className="text-center space-y-4">
            <Database className="mx-auto h-16 w-16 text-muted-foreground/50" />
            <h2 className="text-xl font-semibold">开始创建知识库</h2>
            <p className="text-muted-foreground max-w-md">
              知识库可以帮助你组织和管理文档，并基于文档内容进行智能对话
            </p>
            <Button
              onClick={() => {
                const sidebar = document.querySelector(
                  "[data-kb-create]"
                ) as HTMLButtonElement;
                sidebar?.click();
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              创建知识库
            </Button>
          </div>
        ) : (
          <div className="text-center text-muted-foreground">
            <Database className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>选择一个知识库查看内容</p>
          </div>
        )}
      </div>
    </div>
  );
}
