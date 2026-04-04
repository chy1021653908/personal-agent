import type { RunnableConfig } from "@langchain/core/runnables";
import { tool } from "@langchain/core/tools";
import { getWriter } from "@langchain/langgraph";
import { z } from "zod";
import { createCitationSource, getSourceLink } from "@/lib/ai/source";
import type { CitationSource } from "@/lib/db/schema";

export type TavilyRawItem = {
  title: string;
  url: string;
  content: string;
};

const tavilySearchSchema = z.object({
  query: z.string().min(1).describe("要搜索的关键词或问题"),
  summary: z
    .string()
    .min(1)
    .optional()
    .describe("当前这次搜索的简短说明，用于前端思维链展示"),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe("返回结果数，默认 1"),
});

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
};

type TavilyResponse = {
  answer?: string;
  results?: TavilyResult[];
};

type SearchInvocationEndArgs = {
  searchIndex: number;
  query: string;
  outcome: "success" | "error";
  sources?: CitationSource[];
  answer?: string;
  errorMessage?: string;
};

type CreateWebSearchToolOptions = {
  reserveCitationRange: (count: number) => number;
  onSearchStart?: (
    args: {
      searchIndex: number;
      query: string;
      summary?: string;
      maxResults?: number;
    },
    config?: RunnableConfig,
  ) => void;
  onSearchEnd?: (
    args: SearchInvocationEndArgs,
    config?: RunnableConfig,
  ) => void;
};

/** URL 归一化，用于合并结果时去重 */
export function normalizeWebSearchUrl(u: string): string {
  const s = u.trim();
  if (!s) return "";
  try {
    const x = new URL(s);
    return x.href.replace(/\/$/, "");
  } catch {
    return s.toLowerCase();
  }
}

/**
 * 仅请求 Tavily，不做引用编号（编号在合并后统一分配）。
 */
export async function executeTavilyWebSearch(
  query: string,
  options?: { maxResults?: number },
): Promise<
  | { ok: true; answer: string; items: TavilyRawItem[] }
  | { ok: false; error: string }
> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "未配置 TAVILY_API_KEY" };
  }

  let response: Response;
  try {
    response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "advanced",
        include_answer: true,
        max_results: options?.maxResults ?? 1,
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `网络错误：${message}` };
  }

  if (!response.ok) {
    return { ok: false, error: `HTTP ${response.status}` };
  }

  const data = (await response.json()) as TavilyResponse;
  const items: TavilyRawItem[] = (data.results ?? [])
    .map((item) => ({
      title: item.title?.trim() || "Web Source",
      url: item.url?.trim() || "",
      content: item.content?.trim() || "",
    }))
    .filter((item) => item.url || item.content);

  if (items.length === 0) {
    return { ok: false, error: `未找到与「${query}」相关的可用网页结果` };
  }

  return {
    ok: true,
    answer: data.answer?.trim() || "",
    items,
  };
}

/** 按任务顺序遍历原始条目，URL 去重后分配全局 [1..N] 引用号 */
export function mergeTavilyItemsToCitations(
  taskResultItems: Array<{ items: TavilyRawItem[] }>,
): CitationSource[] {
  const seen = new Set<string>();
  const out: CitationSource[] = [];

  for (const bundle of taskResultItems) {
    for (const it of bundle.items) {
      const url = it.url.trim();
      const key = url
        ? normalizeWebSearchUrl(url)
        : normalizeWebSearchUrl(it.title);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(
        createCitationSource({
          source: "web",
          index: out.length + 1,
          fileName: it.title,
          documentId: url || it.title,
          chunkIndex: out.length,
          content: it.content.slice(0, 200),
          url,
        }),
      );
    }
  }

  return out;
}

export function createWebSearchTool({
  reserveCitationRange,
  onSearchStart,
  onSearchEnd,
}: CreateWebSearchToolOptions) {
  let invocationCount = 0;

  return tool(
    async (
      { query, maxResults, summary }: z.infer<typeof tavilySearchSchema>,
      config?: RunnableConfig,
    ) => {
      invocationCount += 1;
      const searchIndex = invocationCount;
      onSearchStart?.({ searchIndex, query, summary, maxResults }, config);

      const endError = (message: string) => {
        onSearchEnd?.(
          {
            searchIndex,
            query,
            outcome: "error",
            errorMessage: message,
          },
          config,
        );
      };

      const raw = await executeTavilyWebSearch(query, { maxResults });
      if (!raw.ok) {
        endError(raw.error);
        return raw.error.startsWith("未配置")
          ? "Web 搜索暂不可用：未配置 TAVILY_API_KEY。"
          : `Web 搜索失败：${raw.error}`;
      }

      const baseIndex = reserveCitationRange(raw.items.length);
      const sources: CitationSource[] = raw.items.map((item, idx) =>
        createCitationSource({
          source: "web",
          index: baseIndex + idx,
          fileName: item.title,
          documentId: item.url || item.title,
          chunkIndex: Math.max(baseIndex + idx - 1, 0),
          content: item.content.slice(0, 200),
          url: item.url,
        }),
      );

      getWriter(config)?.({
        type: "source-url",
        id: `web-sources-${baseIndex}`,
        sources,
      });

      const lines: string[] = [];
      if (raw.answer) {
        lines.push(`Tavily 摘要：${raw.answer}`);
      }
      lines.push("可引用来源（回答中请使用 [N]）：");
      for (const source of sources) {
        lines.push(
          `[来源 ${source.index}] ${source.fileName}\nURL: ${getSourceLink(source) ?? source.documentId}\n摘要: ${source.content}`,
        );
      }
      const context = lines.join("\n\n");
      const content = JSON.stringify(
        {
          type: "web_search_result",
          query,
          answer: raw.answer,
          sources: sources.map((item) => ({
            index: item.index,
            source: item.source,
            title: item.fileName,
            url: item.url,
            citedText: item.content,
          })),
          context,
        },
        null,
        2,
      );
      const artifact = {
        type: "citation_sources",
        provider: "web",
        query,
        answer: raw.answer,
        sources,
      };
      onSearchEnd?.(
        {
          searchIndex,
          query,
          outcome: "success",
          sources,
          answer: raw.answer || undefined,
        },
        config,
      );
      return [content, artifact] as const;
    },
    {
      name: "web_search",
      description:
        "使用 Tavily 进行实时网页搜索，返回可引用来源编号、标题、URL 和摘要。",
      schema: tavilySearchSchema,
      responseFormat: "content_and_artifact",
    },
  );
}
