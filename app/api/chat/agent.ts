import { createAgent } from "langchain";
import { buildSystemPrompt } from "@/lib/ai/prompts";
import { createLangChainChatModel } from "@/lib/ai/langchain-model";
import type { ChatModelProvider } from "@/lib/ai/model-provider";
import type { getLangGraphCheckpointer } from "@/lib/ai/checkpointer";

type Checkpointer = Awaited<ReturnType<typeof getLangGraphCheckpointer>>;

type CreateChatAgentOptions = {
  modelName: string;
  modelProvider: ChatModelProvider;
  shouldRunRag: boolean;
  tools: ReturnType<typeof createAgent> extends never ? never : Parameters<
    typeof createAgent
  >[0]["tools"];
  checkpointer: Checkpointer;
};

export function createChatAgent({
  modelName,
  modelProvider,
  shouldRunRag,
  tools,
  checkpointer,
}: CreateChatAgentOptions) {
  return createAgent({
    model: createLangChainChatModel(modelName, modelProvider),
    systemPrompt: buildSystemPrompt(undefined, {
      knowledgeSearchEnabled: shouldRunRag,
    }),
    tools,
    checkpointer,
  });
}
