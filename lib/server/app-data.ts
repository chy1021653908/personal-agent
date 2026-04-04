import { cache } from "react";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import {
  conversations,
  documents,
  folders,
  knowledgeBases,
  messages,
  webSearchThreads,
} from "@/lib/db/schema";
import type {
  Conversation,
  Document,
  Folder,
  KnowledgeBase,
  Message,
  WebSearchThread,
} from "@/types";

export type ConversationDetail = Conversation & { messages: Message[] };

export type KnowledgeBaseDetail = {
  knowledgeBase: KnowledgeBase;
  folders: Folder[];
  documents: Document[];
};

const getCurrentUserId = cache(async () => {
  const session = await getSession();
  return session?.user.id ?? null;
});

export const getUserConversations = cache(async (): Promise<Conversation[]> => {
  const userId = await getCurrentUserId();
  if (!userId) {
    return [];
  }

  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt));

  return rows.map((conversation) => ({
    ...conversation,
    retrievalScope: (conversation.retrievalScope ??
      "none") as Conversation["retrievalScope"],
  }));
});

export const getConversationDetail = cache(
  async (conversationId: string): Promise<ConversationDetail | null> => {
    const userId = await getCurrentUserId();
    if (!userId) {
      return null;
    }

    const [conversation] = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.userId, userId),
        ),
      );

    if (!conversation) {
      return null;
    }

    const conversationMessages = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        role: messages.role,
        parts: messages.parts,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt), asc(messages.id));

    return {
      ...conversation,
      retrievalScope: (conversation.retrievalScope ??
        "none") as Conversation["retrievalScope"],
      messages: conversationMessages as Message[],
    };
  },
);

export const getUserWebSearchThreads = cache(
  async (): Promise<WebSearchThread[]> => {
    const userId = await getCurrentUserId();
    if (!userId) {
      return [];
    }

    return db
      .select()
      .from(webSearchThreads)
      .where(eq(webSearchThreads.userId, userId))
      .orderBy(desc(webSearchThreads.updatedAt));
  },
);

export const getUserKnowledgeBases = cache(
  async (): Promise<KnowledgeBase[]> => {
    const userId = await getCurrentUserId();
    if (!userId) {
      return [];
    }

    const kbs = await db
      .select()
      .from(knowledgeBases)
      .where(eq(knowledgeBases.userId, userId))
      .orderBy(knowledgeBases.createdAt);

    if (kbs.length === 0) {
      return [];
    }

    const kbIds = kbs.map((kb) => kb.id);
    const counts = await db
      .select({
        knowledgeBaseId: documents.knowledgeBaseId,
        documentCount: sql<number>`count(*)::int`,
      })
      .from(documents)
      .where(inArray(documents.knowledgeBaseId, kbIds))
      .groupBy(documents.knowledgeBaseId);

    const countByKbId = new Map(
      counts.map((item) => [item.knowledgeBaseId, item.documentCount]),
    );

    return kbs.map((kb) => ({
      ...kb,
      documentCount: countByKbId.get(kb.id) ?? 0,
    }));
  },
);

export const getKnowledgeBaseDetail = cache(
  async (knowledgeBaseId: string): Promise<KnowledgeBaseDetail | null> => {
    const userId = await getCurrentUserId();
    if (!userId) {
      return null;
    }

    const [knowledgeBase] = await db
      .select()
      .from(knowledgeBases)
      .where(
        and(
          eq(knowledgeBases.id, knowledgeBaseId),
          eq(knowledgeBases.userId, userId),
        ),
      );

    if (!knowledgeBase) {
      return null;
    }

    const [folderList, documentList] = await Promise.all([
      db
        .select()
        .from(folders)
        .where(eq(folders.knowledgeBaseId, knowledgeBaseId))
        .orderBy(folders.name),
      db
        .select()
        .from(documents)
        .where(eq(documents.knowledgeBaseId, knowledgeBaseId))
        .orderBy(documents.createdAt),
    ]);

    return {
      knowledgeBase,
      folders: folderList,
      documents: documentList.map((document) => ({
        ...document,
        status: document.status as Document["status"],
      })),
    };
  },
);
