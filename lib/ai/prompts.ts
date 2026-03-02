import type { RetrievalResult } from "@/lib/rag/retriever";

export function buildSystemPrompt(
  context?: RetrievalResult[]
): string {
  let prompt = `你是一个智能知识助手。请用准确、简洁的方式回答用户问题。
如果你不确定答案，请诚实地说明。回答时使用 Markdown 格式。`;

  if (context && context.length > 0) {
    prompt += `\n\n以下是从知识库中检索到的相关内容，请基于这些内容回答用户问题。
如果检索到的内容不足以回答问题，可以结合你的知识进行补充，但要标注哪些是来自知识库的信息。

--- 知识库检索结果 ---
`;
    context.forEach((result, i) => {
      prompt += `\n[来源 ${i + 1}: ${result.fileName}]\n${result.content}\n`;
    });
    prompt += "\n--- 检索结果结束 ---";
  }

  return prompt;
}

export function formatSourcesForMessage(
  results: RetrievalResult[]
) {
  return results.map((r) => ({
    documentId: r.documentId,
    fileName: r.fileName,
    chunkIndex: r.chunkIndex,
    content: r.content.slice(0, 200),
  }));
}
