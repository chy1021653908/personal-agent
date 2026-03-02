import { openai } from "@ai-sdk/openai";
import { embedMany, embed } from "ai";

const embeddingModel = openai.embedding("text-embedding-3-small");

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const batchSize = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: batch,
    });
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}

export async function embedQuery(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
  });
  return embedding;
}
