export const CHAT_MODEL_PROVIDERS = ["openai", "anthropic"] as const;

export type ChatModelProvider = (typeof CHAT_MODEL_PROVIDERS)[number];
