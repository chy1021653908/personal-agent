import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
  separators: ["\n\n", "\n", "。", "！", "？", ".", "!", "?", " ", ""],
});

export async function splitText(
  text: string
): Promise<{ content: string; index: number }[]> {
  const chunks = await splitter.splitText(text);
  return chunks.map((content, index) => ({ content, index }));
}
