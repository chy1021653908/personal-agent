import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";

// 使用 Vercel AI Gateway：优先使用 AI_GATEWAY_API_KEY，否则回退到 OPENAI_API_KEY
const VERCEL_GATEWAY_URL = "https://ai-gateway.vercel.sh/v1";

export const openaiProvider = createOpenAI({
  apiKey: process.env.AI_GATEWAY_API_KEY ?? process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_GATEWAY_API_KEY ? VERCEL_GATEWAY_URL : process.env.OPENAI_BASE_URL,
});

export const anthropicProvider = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type ModelProvider = "openai" | "anthropic";

const MODEL_MAP: Record<ModelProvider, Record<string, ReturnType<typeof openaiProvider>>> = {
  openai: {
    "gpt-4o": openaiProvider("gpt-4o"),
    "gpt-4o-mini": openaiProvider("gpt-4o-mini"),
  },
  anthropic: {} as Record<string, ReturnType<typeof openaiProvider>>,
};

export function getModel(provider: ModelProvider = "openai", model?: string) {
  if (provider === "anthropic") {
    return anthropicProvider(model || "claude-sonnet-4-20250514");
  }
  return MODEL_MAP.openai[model || "gpt-4o-mini"] || openaiProvider(model || "gpt-4o-mini");
}
