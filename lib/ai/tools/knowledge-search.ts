import type { RunnableConfig } from "@langchain/core/runnables";
import { tool } from "@langchain/core/tools";
import { getWriter } from "@langchain/langgraph";
import { z } from "zod";
import { createCitationSource } from "@/lib/ai/source";
import type { CitationSource } from "@/lib/db/schema";
import { retrieve } from "@/lib/rag/retriever";

const knowledgeSearchSchema = z.object({
  query: z.string().min(1).describe("要在知识库中检索的问题或关键词"),
  summary: z
    .string()
    .min(1)
    .optional()
    .describe("当前这次搜索的简短说明，用于前端思维链展示"),
  topK: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe("返回结果数量，默认 5"),
});

type CreateKnowledgeSearchToolOptions = {
  enabled: boolean;
  knowledgeBaseId?: string;
  scope?: "knowledge_base" | "folder" | "document";
  scopeId?: string;
  reserveCitationRange: (count: number) => number;
};

export function createKnowledgeSearchTool({
  enabled,
  knowledgeBaseId,
  scope,
  scopeId,
  reserveCitationRange,
}: CreateKnowledgeSearchToolOptions) {
  return tool(
    async (
      { query, topK }: z.infer<typeof knowledgeSearchSchema>,
      config?: RunnableConfig,
    ) => {
      if (!enabled || !knowledgeBaseId) {
        return "当前会话未启用知识库检索。";
      }

      const results = await retrieve({
        knowledgeBaseId,
        query,
        topK: topK ?? 5,
        scope,
        scopeId,
      });

      if (results.length === 0) {
        return JSON.stringify(
          {
            type: "knowledge_search_result",
            query,
            sources: [],
            context: "",
          },
          null,
          2,
        );
      }

      const startIndex = reserveCitationRange(results.length);
      const sources: CitationSource[] = results.map((result, idx) =>
        createCitationSource({
          source: "knowledge_base",
          index: startIndex + idx,
          fileName: result.fileName || "Knowledge Base",
          documentId: result.documentId,
          chunkIndex: result.chunkIndex,
          content: result.content.slice(0, 200),
          url: result.documentId ? `kb://document/${result.documentId}` : "",
        }),
      );

      getWriter(config)?.({
        type: "source-url",
        id: `kb-sources-${startIndex}`,
        sources,
      });

      const context = sources
        .map((item) => `[来源 ${item.index}: ${item.fileName}]\n${item.content}`)
        .join("\n\n");

      const content = JSON.stringify(
        {
          type: "knowledge_search_result",
          query,
          sources: sources.map((item) => ({
            index: item.index,
            source: item.source,
            title: item.fileName,
            url: item.url,
            citedText: item.content,
          })),
          context,
        },
        null,
        2,
      );
      const artifact = {
        type: "citation_sources",
        provider: "knowledge_base",
        query,
        sources,
      };
      return [content, artifact] as const;
    },
    {
      name: "search_knowledge_base",
      description:
        "在当前知识库中检索相关内容并返回可引用来源编号、文档信息和摘要。",
      schema: knowledgeSearchSchema,
      responseFormat: "content_and_artifact",
    },
  );
}
