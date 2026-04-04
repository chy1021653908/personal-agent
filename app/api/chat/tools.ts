import { createKnowledgeSearchTool } from "@/lib/ai/tools/knowledge-search";
import { createWebSearchTool } from "@/lib/ai/tools/web-search";
import { createWeatherTool } from "@/lib/ai/tools/weather";

type BuildChatToolsOptions = {
  shouldRunRag: boolean;
  requestKnowledgeBaseId?: string;
  requestRetrievalScope?: "knowledge_base" | "folder" | "document" | "none";
  requestRetrievalScopeId?: string;
  reserveCitationRange: (count: number) => number;
};

export function buildChatTools({
  shouldRunRag,
  requestKnowledgeBaseId,
  requestRetrievalScope,
  requestRetrievalScopeId,
  reserveCitationRange,
}: BuildChatToolsOptions) {
  const weatherTool = createWeatherTool();

  if (!shouldRunRag) {
    return [weatherTool, createWebSearchTool({ reserveCitationRange })];
  }

  return [
    weatherTool,
    createKnowledgeSearchTool({
      enabled: true,
      knowledgeBaseId: requestKnowledgeBaseId,
      scope:
        requestRetrievalScope === "knowledge_base" ||
        requestRetrievalScope === "folder" ||
        requestRetrievalScope === "document"
          ? requestRetrievalScope
          : undefined,
      scopeId: requestRetrievalScopeId,
      reserveCitationRange,
    }),
  ];
}
