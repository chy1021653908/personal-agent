import { ChatOpenAI } from "@langchain/openai";

export const DEFAULT_CHAT_MODEL = "gpt-4o-mini";

const MODEL_ALIASES: Record<string, string> = {
  "openai/gpt-oss-20b": DEFAULT_CHAT_MODEL,
  "deepseek/deepseek-v3.2-thinking": DEFAULT_CHAT_MODEL,
};

export function normalizeModelName(modelName?: string): string {
  if (!modelName) return DEFAULT_CHAT_MODEL;
  return MODEL_ALIASES[modelName] ?? modelName;
}

export function createLangChainChatModel(modelName?: string): ChatOpenAI {
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.AI_GATEWAY_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL;

  return new ChatOpenAI({
    model: normalizeModelName(modelName),
    temperature: 0.2,
    apiKey,
    ...(baseURL ? { configuration: { baseURL } } : {}),
  });
}
