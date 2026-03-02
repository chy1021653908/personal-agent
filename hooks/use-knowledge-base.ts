"use client";

import { useState, useEffect, useCallback } from "react";
import type { KnowledgeBase, Folder, Document } from "@/types";

export function useKnowledgeBases() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchKnowledgeBases = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge");
      if (res.ok) {
        setKnowledgeBases(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch knowledge bases:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKnowledgeBases();
  }, [fetchKnowledgeBases]);

  const createKnowledgeBase = async (name: string, description?: string) => {
    const res = await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    if (res.ok) {
      const kb = await res.json();
      setKnowledgeBases((prev) => [...prev, kb]);
      return kb;
    }
    throw new Error("Failed to create knowledge base");
  };

  const deleteKnowledgeBase = async (id: string) => {
    const res = await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
    if (res.ok) {
      setKnowledgeBases((prev) => prev.filter((kb) => kb.id !== id));
    }
  };

  return {
    knowledgeBases,
    loading,
    createKnowledgeBase,
    deleteKnowledgeBase,
    refresh: fetchKnowledgeBases,
  };
}

export function useFolders(knowledgeBaseId: string | null) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);

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
    fetchFolders();
  }, [fetchFolders]);

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

  return { folders, loading, createFolder, refresh: fetchFolders };
}

export function useDocuments(
  knowledgeBaseId: string | null,
  folderId?: string | null
) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);

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
    fetchDocuments();
  }, [fetchDocuments]);

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
      return doc;
    }
    throw new Error("Upload failed");
  };

  return { documents, loading, uploadDocument, refresh: fetchDocuments };
}
