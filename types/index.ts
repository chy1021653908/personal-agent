export interface KnowledgeBase {
  id: string;
  userId: string;
  name: string;
  description: string | null;
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

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources: Source[] | null;
  createdAt: Date;
}

export interface Source {
  documentId: string;
  fileName: string;
  chunkIndex: number;
  content: string;
}

export interface RetrievalConfig {
  scope: "knowledge_base" | "folder" | "document" | "none";
  scopeId?: string;
  knowledgeBaseId?: string;
}
