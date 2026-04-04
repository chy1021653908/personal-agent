import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import type { ChatModelProvider } from "@/lib/ai/model-provider";

function requireChatModelName(modelName: string): string {
  const name = modelName.trim();
  if (!name) {
    throw new Error("Model name is required");
  }
  return name;
}

/** OpenAI 兼容格式 */
export function createOpenAIChatModel(modelName: string): ChatOpenAI {
  const baseURL = process.env.OPENAI_BASE_URL?.trim();

  return new ChatOpenAI({
    model: requireChatModelName(modelName),
    apiKey: process.env.OPENAI_API_KEY,
    outputVersion: "v1",
    ...(baseURL ? { configuration: { baseURL } } : {}),
  });
}

/** Anthropic 格式（Claude / MiniMax 等兼容），支持 extended thinking */
export function createAnthropicChatModel(modelName: string): ChatAnthropic {
  return new ChatAnthropic({
    model: requireChatModelName(modelName),
    apiKey: process.env.ANTHROPIC_API_KEY,
    anthropicApiUrl: process.env.ANTHROPIC_BASE_URL,
    outputVersion: "v1",
  });
}

export function createLangChainChatModel(
  modelName: string,
  provider: ChatModelProvider,
): ChatOpenAI | ChatAnthropic {
  return provider === "anthropic"
    ? createAnthropicChatModel(modelName)
    : createOpenAIChatModel(modelName);
}
