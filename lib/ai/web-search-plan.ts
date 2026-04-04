import { z } from "zod";

const planStepSchema = z.object({
  title: z
    .string()
    .min(1)
    .describe("本步要完成的内容，面向用户展示，例如：正在搜索 xxx 相关资料"),
  /** 模型常输出多于 3 条；截断以通过校验，避免回退启发式把整段 JSON 当成 title */
  suggested_queries: z.preprocess(
    (val) => {
      if (val === undefined || val === null) return undefined;
      if (!Array.isArray(val)) return val;
      return val.slice(0, 3);
    },
    z.array(z.string().min(1)).optional(),
  ).describe("本步建议的检索词列表，最多取前 3 条；缺省则由执行模型自拟 query"),
});

/** 规划节点输出：最多 3 步，与单次请求的 web_search 上限对齐。 */
export const webSearchPlanOutputSchema = z.object({
  steps: z.preprocess(
    (val) => (Array.isArray(val) ? val.slice(0, 3) : val),
    z.array(planStepSchema).min(1).max(3),
  ),
});

export type WebSearchPlanOutput = z.infer<typeof webSearchPlanOutputSchema>;

function tryJsonParse(s: string): unknown {
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return null;
  }
}

/** 从模型原文中尽量抽出单个 JSON 对象（整段、```json 代码块、或首尾花括号切片）。 */
export function extractJsonObjectFromText(text: string): unknown | null {
  const trimmed = text.trim();
  let m = tryJsonParse(trimmed);
  if (m != null) return m;

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    m = tryJsonParse(fence[1].trim());
    if (m != null) return m;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    m = tryJsonParse(trimmed.slice(start, end + 1));
    if (m != null) return m;
  }
  return null;
}

function defaultPlanSteps(userQuery: string): WebSearchPlanOutput["steps"] {
  const q = userQuery.trim().slice(0, 200);
  return [
    {
      title: "根据用户问题检索相关网页信息",
      suggested_queries: [q || "用户问题"],
    },
  ];
}

/** 若首行或全文实为 JSON 规划（但此前因校验失败走到启发式），再尝试抽对象解析，避免把 JSON 字符串当作 title。 */
function tryParsePlanJsonFromHeuristicInput(text: string): WebSearchPlanOutput["steps"] | null {
  const trimmed = text.trim();
  const json =
    extractJsonObjectFromText(trimmed) ??
    (() => {
      const first = trimmed.split(/\r?\n/).find((l) => l.trim().length > 0)?.trim() ?? "";
      return first.startsWith("{") ? extractJsonObjectFromText(first) : null;
    })();
  if (json == null) return null;
  const parsed = webSearchPlanOutputSchema.safeParse(json);
  return parsed.success ? parsed.data.steps.slice(0, 3) : null;
}

/** 常见「偷懒」输出：首行作说明、次行起逗号分隔检索词（与网关不遵守 JSON 约束时一致）。 */
function heuristicPlanFromProse(
  text: string,
  userQuery: string,
): WebSearchPlanOutput["steps"] {
  const fromJson = tryParsePlanJsonFromHeuristicInput(text);
  if (fromJson) return fromJson;

  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return defaultPlanSteps(userQuery);

  const title = lines[0].replace(/^[\s\-*•]+/u, "").slice(0, 200);
  const rest = lines.slice(1).join("\n");
  const queries = rest
    .split(/[,，、;；]/u)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  const candidate: WebSearchPlanOutput = {
    steps: [
      {
        title: title || "联网检索",
        suggested_queries:
          queries.length > 0
            ? queries
            : [userQuery.trim().slice(0, 200) || "检索"],
      },
    ],
  };
  const parsed = webSearchPlanOutputSchema.safeParse(candidate);
  return parsed.success
    ? parsed.data.steps.slice(0, 3)
    : defaultPlanSteps(userQuery);
}

/** 将规划模型输出解析为 plan steps；JSON 优先，失败则用启发式，再失败则单步兜底。 */
export function parseWebSearchPlanFromLlmText(
  raw: string,
  fallbackUserQuery: string,
): WebSearchPlanOutput["steps"] {
  const json = extractJsonObjectFromText(raw);
  if (json != null) {
    const parsed = webSearchPlanOutputSchema.safeParse(json);
    if (parsed.success) return parsed.data.steps.slice(0, 3);
  }
  return heuristicPlanFromProse(raw, fallbackUserQuery);
}
