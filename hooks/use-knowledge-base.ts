"use client";

import { useState, useEffect, useCallback } from "react";
import type { KnowledgeBase, Folder, Document } from "@/types";

let knowledgeBasesCache: KnowledgeBase[] | null = null;
let knowledgeBasesRequest: Promise<KnowledgeBase[]> | null = null;

async function requestKnowledgeBases(force = false): Promise<KnowledgeBase[]> {
  if (!force && knowledgeBasesCache) {
    return knowledgeBasesCache;
  }

  if (!force && knowledgeBasesRequest) {
    return knowledgeBasesRequest;
  }

  knowledgeBasesRequest = (async () => {
    const res = await fetch("/api/knowledge");
    if (!res.ok) {
      throw new Error("Failed to fetch knowledge bases");
    }
    const data = (await res.json()) as KnowledgeBase[];
    knowledgeBasesCache = data;
    return data;
  })();

  try {
    return await knowledgeBasesRequest;
  } finally {
    knowledgeBasesRequest = null;
  }
}

export function useKnowledgeBases(initialKnowledgeBases?: KnowledgeBase[]) {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>(
    () => {
      if (initialKnowledgeBases !== undefined) {
        knowledgeBasesCache = initialKnowledgeBases;
        return initialKnowledgeBases;
      }
      return knowledgeBasesCache ?? [];
    },
  );
  const [loading, setLoading] = useState(
    initialKnowledgeBases === undefined && knowledgeBasesCache === null,
  );

  const fetchKnowledgeBases = useCallback(async (force = false) => {
    try {
      const data = await requestKnowledgeBases(force);
      setKnowledgeBases(data);
    } catch (error) {
      console.error("Failed to fetch knowledge bases:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialKnowledgeBases !== undefined) {
      knowledgeBasesCache = initialKnowledgeBases;
      setKnowledgeBases(initialKnowledgeBases);
      setLoading(false);
      return;
    }
    fetchKnowledgeBases();
  }, [fetchKnowledgeBases, initialKnowledgeBases]);

  const createKnowledgeBase = async (name: string, description?: string) => {
    const res = await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    if (res.ok) {
      const kb = await res.json();
      setKnowledgeBases((prev) => {
        const next = [...prev, kb];
        knowledgeBasesCache = next;
        return next;
      });
      return kb;
    }
    throw new Error("Failed to create knowledge base");
  };

  const deleteKnowledgeBase = async (id: string) => {
    const res = await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
    if (res.ok) {
      setKnowledgeBases((prev) => {
        const next = prev.filter((kb) => kb.id !== id);
        knowledgeBasesCache = next;
        return next;
      });
    }
  };

  return {
    knowledgeBases,
    loading,
    createKnowledgeBase,
    deleteKnowledgeBase,
    refresh: () => fetchKnowledgeBases(true),
  };
}

export function useFolders(
  knowledgeBaseId: string | null,
  initialFolders?: Folder[],
) {
  const [folders, setFolders] = useState<Folder[]>(initialFolders ?? []);
  const [loading, setLoading] = useState(initialFolders === undefined);

  const fetchFolders = useCallback(async () => {
    if (!knowledgeBaseId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/knowledge/${knowledgeBaseId}/folders`
      );
      if (res.ok) {
        setFolders(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch folders:", error);
    } finally {
      setLoading(false);
    }
  }, [knowledgeBaseId]);

  useEffect(() => {
    if (initialFolders !== undefined) {
      setFolders(initialFolders);
      setLoading(false);
      return;
    }
    fetchFolders();
  }, [fetchFolders, initialFolders]);

  const createFolder = async (name: string, parentFolderId?: string) => {
    if (!knowledgeBaseId) return;
    const res = await fetch(
      `/api/knowledge/${knowledgeBaseId}/folders`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentFolderId }),
      }
    );
    if (res.ok) {
      const folder = await res.json();
      setFolders((prev) => [...prev, folder]);
      return folder;
    }
    throw new Error("Failed to create folder");
  };

  const renameFolder = async (folderId: string, name: string) => {
    if (!knowledgeBaseId) return;

    const res = await fetch(
      `/api/knowledge/${knowledgeBaseId}/folders/${folderId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }
    );

    if (res.ok) {
      const folder = (await res.json()) as Folder;
      setFolders((prev) => prev.map((f) => (f.id === folder.id ? folder : f)));
      return folder;
    }

    throw new Error("Failed to rename folder");
  };

  const deleteFolder = async (folderId: string) => {
    if (!knowledgeBaseId) return [] as string[];

    const res = await fetch(
      `/api/knowledge/${knowledgeBaseId}/folders/${folderId}`,
      {
        method: "DELETE",
      }
    );

    if (res.ok) {
      const data = (await res.json()) as { deletedFolderIds?: string[] };
      const deletedFolderIds = data.deletedFolderIds ?? [folderId];
      setFolders((prev) =>
        prev.filter((folder) => !deletedFolderIds.includes(folder.id))
      );
      return deletedFolderIds;
    }

    throw new Error("Failed to delete folder");
  };

  return {
    folders,
    loading,
    createFolder,
    renameFolder,
    deleteFolder,
    refresh: fetchFolders,
  };
}

export function useDocuments(
  knowledgeBaseId: string | null,
  folderId?: string | null,
  initialDocuments?: Document[],
) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments ?? []);
  const [loading, setLoading] = useState(initialDocuments === undefined);

  const fetchDocuments = useCallback(async () => {
    if (!knowledgeBaseId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (folderId) params.set("folderId", folderId);
      const res = await fetch(
        `/api/knowledge/${knowledgeBaseId}/documents?${params}`
      );
      if (res.ok) {
        setDocuments(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setLoading(false);
    }
  }, [knowledgeBaseId, folderId]);

  useEffect(() => {
    if (initialDocuments !== undefined) {
      setDocuments(initialDocuments);
      setLoading(false);
      return;
    }
    fetchDocuments();
  }, [fetchDocuments, initialDocuments]);

  const pollDocumentStatus = useCallback(
    async (docId: string) => {
      if (!knowledgeBaseId) return;

      const timeoutAt = Date.now() + 2 * 60 * 1000;
      while (Date.now() < timeoutAt) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const params = new URLSearchParams();
        if (folderId) params.set("folderId", folderId);
        const res = await fetch(
          `/api/knowledge/${knowledgeBaseId}/documents?${params}`
        );
        if (!res.ok) continue;

        const latestDocs = (await res.json()) as Document[];
        setDocuments(latestDocs);

        const current = latestDocs.find((d) => d.id === docId);
        if (!current) return;
        if (current.status === "ready" || current.status === "error") return;
      }

      // Ensure UI is refreshed even when polling times out.
      fetchDocuments();
    },
    [fetchDocuments, folderId, knowledgeBaseId]
  );

  const triggerDocumentIndexing = useCallback(
    async (docId: string) => {
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, status: "processing" } : d))
      );

      const res = await fetch("/api/rag/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: docId }),
      });
      if (!res.ok) {
        setDocuments((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, status: "error" } : d))
        );
        throw new Error("Failed to trigger indexing");
      }

      void pollDocumentStatus(docId);
    },
    [pollDocumentStatus]
  );

  const uploadDocument = async (file: File, targetFolderId?: string) => {
    if (!knowledgeBaseId) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("knowledgeBaseId", knowledgeBaseId);
    if (targetFolderId) formData.append("folderId", targetFolderId);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const doc = await res.json();
      setDocuments((prev) => [...prev, doc]);
      try {
        await triggerDocumentIndexing(doc.id);
      } catch (error) {
        console.error("Failed to trigger document indexing:", error);
      }

      return doc;
    }
    throw new Error("Upload failed");
  };

  return {
    documents,
    loading,
    uploadDocument,
    triggerDocumentIndexing,
    refresh: fetchDocuments,
  };
}
