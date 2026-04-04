import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  uuid,
} from "drizzle-orm/pg-core";

export type StoredSourceKind = "knowledge_base" | "web";

export type StoredSourceRef = {
  index?: number;
  sourceId?: string;
  source?: StoredSourceKind;
  url?: string;
  title?: string;
  citedText?: string;
  documentId?: string;
  chunkIndex?: number;
};

export type StoredSource = StoredSourceRef & {
  documentId: string;
  fileName: string;
  chunkIndex: number;
  content: string;
};

export type CitationSource = StoredSource & {
  index: number;
  source: StoredSourceKind;
  sourceId: string;
  url: string;
  title: string;
  citedText: string;
};

export type StoredToolSource = StoredSourceRef & {
  title: string;
  domain?: string;
};

export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export type StoredToolPayload = JsonValue;

export type StoredToolStep = {
  key: string;
  name?: string;
  input?: StoredToolPayload;
  output?: StoredToolPayload;
  status: "active" | "complete";
  sources?: StoredToolSource[];
};

export type StoredDynamicToolPart = {
  type: "dynamic-tool";
  toolName: string;
  toolCallId: string;
  state: "input-streaming" | "input-available" | "output-available";
  input?: StoredToolPayload;
  output?: StoredToolPayload;
};

export type StoredDataSourceUrlPart = {
  type: "data-source-url";
  id: string;
  data: {
    type: "source-url";
    id: string;
    sources: CitationSource[];
  };
  transient?: boolean;
};

export type MessagePart =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | StoredDynamicToolPart
  | StoredDataSourceUrlPart;

// ==================== Better Auth 表 ====================

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ==================== 业务表 ====================

export const knowledgeBases = pgTable("knowledge_bases", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const folders = pgTable("folders", {
  id: uuid("id").primaryKey().defaultRandom(),
  knowledgeBaseId: uuid("knowledge_base_id")
    .notNull()
    .references(() => knowledgeBases.id, { onDelete: "cascade" }),
  parentFolderId: uuid("parent_folder_id"),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  folderId: uuid("folder_id").references(() => folders.id, {
    onDelete: "set null",
  }),
  knowledgeBaseId: uuid("knowledge_base_id")
    .notNull()
    .references(() => knowledgeBases.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  fileType: text("file_type").notNull(), // pdf, txt, md, docx, xlsx, url, image
  fileUrl: text("file_url"),
  fileSize: integer("file_size"),
  status: text("status").notNull().default("pending"), // pending, processing, ready, error
  chunkCount: integer("chunk_count").default(0),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("新对话"),
  retrievalScope: text("retrieval_scope").default("none"), // knowledge_base, folder, document, none
  retrievalScopeId: text("retrieval_scope_id"),
  knowledgeBaseId: uuid("knowledge_base_id").references(
    () => knowledgeBases.id,
    { onDelete: "set null" },
  ),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** AI 消息统一持久化为 content blocks */
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // user, assistant, system
  parts: jsonb("parts").$type<MessagePart[]>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** 工作流检索 thread 元数据（与 LangGraph checkpoint 的 thread_id 一致，通常为客户端生成的 UUID） */
export const webSearchThreads = pgTable("web_search_threads", {
  id: uuid("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("工作流检索"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
