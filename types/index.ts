import type { CitationSource, MessagePart } from "@/lib/db/schema";

export interface KnowledgeBase {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  documentCount?: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Folder {
  id: string;
  knowledgeBaseId: string;
  parentFolderId: string | null;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id: string;
  folderId: string | null;
  knowledgeBaseId: string;
  name: string;
  fileType: string;
  fileUrl: string | null;
  fileSize: number | null;
  status: "pending" | "processing" | "ready" | "error";
  chunkCount: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  retrievalScope: "knowledge_base" | "folder" | "document" | "none";
  retrievalScopeId: string | null;
  knowledgeBaseId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** 工作流检索会话（DB 元数据；消息在 LangGraph checkpoint） */
export interface WebSearchThread {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

/** 聊天消息直接持久化为 UI message parts */
export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  parts: MessagePart[];
  createdAt: Date;
}

export type Source = CitationSource;

export interface RetrievalConfig {
  scope: "knowledge_base" | "folder" | "document" | "none";
  scopeId?: string;
  knowledgeBaseId?: string;
}
