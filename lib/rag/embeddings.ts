import { OpenAIEmbeddings } from "@langchain/openai";

const baseURL = process.env.OPENAI_BASE_URL;
const apiKey = process.env.OPENAI_API_KEY ?? process.env.AI_GATEWAY_API_KEY;

let embeddingsInstance: OpenAIEmbeddings | null = null;

export function getEmbeddingsModel(): OpenAIEmbeddings {
  if (!embeddingsInstance) {
    embeddingsInstance = new OpenAIEmbeddings({
      model: "text-embedding-3-small",
      apiKey,
      ...(baseURL ? { configuration: { baseURL } } : {}),
    });
  }

  return embeddingsInstance;
}
