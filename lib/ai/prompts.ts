import type { RetrievalResult } from "@/lib/rag/retriever";
import { getSourceLink } from "@/lib/ai/source";
import type { WebSearchWorkflowRoot } from "@/lib/ai/web-search-workflow-state";
import type { CitationSource } from "@/lib/db/schema";

export function buildSystemPrompt(
  context?: RetrievalResult[],
  options?: {
    knowledgeSearchEnabled?: boolean;
  }
): string {
  let prompt = `你是一个智能知识助手。请用准确、简洁的方式回答用户问题。
如果你不确定答案，请诚实地说明。回答时使用 Markdown 格式。
当你引用任何外部来源（知识库或 Web 搜索）时，请在对应句子后立刻添加：
[N]
其中 N 为来源编号。不要输出 JSON，不要解释标签规则。`;

  prompt += `
当你调用搜索类工具（search_knowledge_base 或 web_search）时，工具参数中必须同时提供：
- query: 实际检索关键词
- summary: 对本次检索动作的简短一句话说明（用于前端思维链标签，需由你生成，不要留空）
并且在搜索工具返回后，你必须继续输出面向用户的最终回答，不能只停在工具调用或工具结果。`;

  prompt += `
当用户明确询问某个地点的当前天气、气温、天气预报、未来几天天气时，优先调用 get_weather。
- location: 必填，填写明确地点名称
- temperatureUnit: 用户明确要求华氏度或摄氏度时再指定；否则可留空
- forecastDays: 按用户需求填写 1 到 7；未说明时可留空
get_weather 返回的是结构化天气数据 JSON，你需要读取其中的 location、current、forecast 字段后，再组织成自然语言回答。
get_weather 返回后，你仍然要继续用自然语言给出最终回答，不能只停在工具结果。`;

  if (options?.knowledgeSearchEnabled) {
    prompt += `
当会话启用知识库时，优先调用工具 search_knowledge_base 获取上下文，再进行回答。
工具返回的 sources 中包含来源编号 N，你必须使用对应编号添加 [N]。`;
  }

  if (context && context.length > 0) {
    prompt += `\n\n以下是从知识库中检索到的相关内容，请基于这些内容回答用户问题。
如果检索到的内容不足以回答问题，可以结合你的知识进行补充，但要标注哪些是来自知识库的信息。
当你引用知识库内容时，请在对应句子后立刻添加 [N]，其中 N 是下方来源编号（从 1 开始）。
不要输出 JSON，不要解释引用规则。
如果后续你调用了 Web 搜索工具，也请对 Web 来源使用同样的 [N] 引用格式（使用工具返回的来源编号 N）。

--- 知识库检索结果 ---
`;
    context.forEach((result, i) => {
      prompt += `\n[来源 ${i + 1}: ${result.fileName}]\n${result.content}\n`;
    });
    prompt += "\n--- 检索结果结束 ---";
  }

  return prompt;
}

/** 规划节点：模型须只输出 JSON（不少网关会忽略原生 structured output，故在提示词中强制约定）。 */
export function buildWebSearchPlanSystemPrompt(): string {
  return `你是检索任务规划器。根据用户问题，制定 1～3 步联网检索计划（步数越少越好，能覆盖即可）。

你必须只输出一个 JSON 对象（不要用 markdown 代码块、不要前缀/后缀说明文字），格式严格如下：
{"steps":[{"title":"字符串","suggested_queries":["检索词1","检索词2"]}]}

字段要求：
- steps：1～3 项；每项 title 为用户可见的一句中文说明。
- suggested_queries：每项最多 3 条检索词或短句，多角度、少重复。

示例（格式示意，请按实际问题替换内容）：
{"steps":[{"title":"检索某主题的最新框架对比","suggested_queries":["主题 框架 2025","主题 GitHub trending"]}]}`;
}

/** 仅启用 Web 检索时的系统提示（配合 `web_search` 工具）；可注入已生成的 plan。 */
export function buildWebSearchSystemPrompt(workflow?: WebSearchWorkflowRoot): string {
  const plan = workflow?.workflow_block?.plan;
  const planBlock =
    plan && plan.length > 0
      ? `
下列检索计划已由系统生成，请尽量按顺序落实；每一步可调用 web_search，但单次对话内工具总调用不超过 3 次。
${plan.map((p, i) => `${i + 1}. ${p.title}`).join("\n")}
`
      : "";

  return `你是一个专注实时网页检索的助手。用户提出问题后，你应根据需要先调用 web_search 获取最新网页信息，再基于工具返回的可引用来源用 Markdown 作答。
单次请求内最多调用 web_search 共 3 次；达到上限后必须停止调用工具，并仅用已有结果作答。
${planBlock}
引用规则：引用句子后使用 [N]，N 为工具返回的来源编号。

当你调用 web_search 时，参数必须同时提供：
- query: 实际检索关键词或问题（可结合计划标题细化改写）
- summary: 一句话说明本次搜索目的（用于前端思维链展示，勿留空）
每次 web_search 返回后都要继续完成最终回答，不要仅输出工具调用。

如工具不可用、返回错误或没有可用结果，请诚实说明，不要编造来源。`;
}

/** 并行检索合并后，写入 state 供 synthesize 节点使用的上下文字符串 */
export function buildWebSearchSynthesisContextBlock(options: {
  mergedSources: CitationSource[];
  tavilyAnswers: string[];
}): string {
  const answers = options.tavilyAnswers.map((a) => a.trim()).filter(Boolean);
  let s = "";
  if (answers.length > 0) {
    s += `${answers.map((a) => `检索摘要片段：${a}`).join("\n\n")}\n\n`;
  }
  s += "统一编号后的可引用来源（回答时句后仅使用下文中的 [N]，勿编造编号）：\n\n";
  if (options.mergedSources.length === 0) {
    s += "（本次未合并到可用网页来源。）\n";
  } else {
    for (const src of options.mergedSources) {
      s += `[${src.index}] ${src.fileName}\nURL: ${getSourceLink(src) ?? src.documentId}\n摘要: ${src.content}\n\n`;
    }
  }
  return s.trim();
}

/** 最终作答：无工具，仅依据 synthesis_context 与用户消息 */
export function buildWebSearchSynthesisSystemPrompt(contextBlock: string): string {
  const block = contextBlock.trim() || "（无检索上下文）";
  return `你是实时网页检索助手。系统已按规划完成并行检索并合并出去重后的来源列表。
请严格根据下方「检索上下文」作答，使用 Markdown；引用句后只使用上下文给出的编号，格式为 [N]。
不要声称你执行了搜索或调用了工具。若无可用来源，请如实说明且勿编造链接或编号。

--- 检索上下文 ---
${block}
--- 检索上下文结束 ---`;
}

/** 用户关闭网页检索时：不引用 [N]，不声称已搜索 */
export function buildWebSearchChatOnlySystemPrompt(): string {
  return `你是一个通用对话助手。本次请求未启用网页检索，请根据用户消息与你的知识作答，使用 Markdown。
不要声称你进行了网页搜索或调用了检索工具，不要使用 [N] 来源引用格式。`;
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
