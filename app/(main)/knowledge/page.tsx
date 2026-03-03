"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useKnowledgeBases } from "@/hooks/use-knowledge-base";
import { Database, Plus, Trash2, Calendar, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export default function KnowledgePage() {
  const router = useRouter();
  const { knowledgeBases, loading, createKnowledgeBase, deleteKnowledgeBase } =
    useKnowledgeBases();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    const kb = await createKnowledgeBase(name, description);
    setName("");
    setDescription("");
    setDialogOpen(false);
    router.push(`/knowledge/${kb.id}`);
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>知识库</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">知识库</h1>
            <p className="text-muted-foreground">
              管理你的文档集合，用于 AI 智能问答
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                创建知识库
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
                    placeholder="例如：公司文档"
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

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">加载中...</p>
          </div>
        ) : knowledgeBases.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] border rounded-lg border-dashed">
            <Database className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-semibold mb-2">暂无知识库</h2>
            <p className="text-muted-foreground max-w-sm text-center mb-6">
              创建一个知识库来开始管理你的文档。你可以上传 PDF、Markdown
              等文件。
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              创建知识库
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {knowledgeBases.map((kb) => (
              <Card
                key={kb.id}
                className="cursor-pointer hover:shadow-md transition-shadow group relative"
                onClick={() => router.push(`/knowledge/${kb.id}`)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="truncate">{kb.name}</span>
                  </CardTitle>
                  <CardDescription className="line-clamp-2 min-h-[40px]">
                    {kb.description || "暂无描述"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      <span>{kb.documentCount || 0} 文档</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {new Date(kb.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteKnowledgeBase(kb.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
