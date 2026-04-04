import { OpenAIEmbeddings } from "@langchain/openai";

const baseURL = process.env.OPENAI_BASE_URL;
const apiKey = process.env.OPENAI_API_KEY;

let embeddingsInstance: OpenAIEmbeddings | null = null;

export function getEmbeddingsModel(): OpenAIEmbeddings {
  if (!embeddingsInstance) {
    embeddingsInstance = new OpenAIEmbeddings({
      model: "text-embedding-v4",
      apiKey,
      batchSize: 10,
      ...(baseURL ? { configuration: { baseURL } } : {}),
    });
  }

  return embeddingsInstance;
}
