import { cache } from "react";
import { MemorySaver } from "@langchain/langgraph";
import type { StreamCompatibleMessage } from "@/lib/ai/langgraph-stream-message-guards";
import type { ChatModelProvider } from "@/lib/ai/model-provider";
import { createLangChainChatModel } from "@/lib/ai/langchain-model";
import { compileWebSearchAgentGraph } from "@/lib/ai/graphs/web-search-agent-graph";
import { getLangGraphCheckpointer } from "@/lib/ai/checkpointer";
import { serializeWebSearchCheckpointMessages } from "@/lib/ai/web-search-checkpoint-messages";

async function compileWebSearchGraphForThread(
  modelName: string,
  modelProvider: ChatModelProvider,
) {
  const checkpointer = process.env.DATABASE_URL?.trim()
    ? await getLangGraphCheckpointer()
    : new MemorySaver();
  const baseModel = createLangChainChatModel(modelName, modelProvider);

  return compileWebSearchAgentGraph({
    model: baseModel,
    planModel: baseModel,
    checkpointer,
  });
}

export const getWebSearchThreadMessages = cache(
  async (
    threadId: string,
    modelName: string,
    modelProvider: ChatModelProvider,
  ): Promise<StreamCompatibleMessage[]> => {
    const graph = await compileWebSearchGraphForThread(
      modelName,
      modelProvider,
    );
    const snap = await graph.getState({
      configurable: { thread_id: threadId },
    });
    const rawMessages = (snap?.values as { messages?: unknown[] } | null)
      ?.messages;

    return serializeWebSearchCheckpointMessages(
      rawMessages,
    ) as StreamCompatibleMessage[];
  },
);
