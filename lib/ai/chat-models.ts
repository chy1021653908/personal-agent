import type { ChatModelProvider } from "@/lib/ai/model-provider";

export type ChatModelOption = {
  chef: string;
  chefSlug: string;
  id: string;
  name: string;
  providers: string[];
  modelProvider: ChatModelProvider;
  category: "openai" | "anthropic";
};

export const CHAT_MODELS = [
  {
    chef: "DeepSeek",
    chefSlug: "deepseek" as const,
    id: "agent/deepseek-v3.2(free)",
    name: "DeepSeek V3.2",
    providers: ["deepseek"],
    modelProvider: "openai" as const,
    category: "openai" as const,
  },
  // {
  //   chef: "Alibaba",
  //   chefSlug: "alibaba" as const,
  //   id: "agent/minimax-m2.7",
  //   name: "agent/minimax-m2.7",
  //   providers: ["alibaba"],
  //   modelProvider: "anthropic" as const,
  //   category: "anthropic" as const,
  // },
] satisfies ChatModelOption[];
