import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import type {
  ParallelWebSearchTask,
  WebSearchWorkflowRoot,
} from "@/lib/ai/web-search-workflow-state";
import type { CitationSource } from "@/lib/db/schema";

/** Web 检索图：对话消息 + 侧栏 workflow + 合并检索后的正文上下文（供综合作答） */
export const WebSearchGraphAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  /** 每轮请求由 API 注入；false 时跳过 plan/search，直接 synthesize */
  use_web_search: Annotation<boolean>({
    reducer: (prev, next) => (typeof next === "boolean" ? next : prev),
    default: () => false,
  }),
  workflow_root: Annotation<WebSearchWorkflowRoot>(),
  /** 规划节点展开后的检索任务；供 search 按规划行分批物化关键词并串行执行 */
  search_tasks: Annotation<ParallelWebSearchTask[]>({
    reducer: (prev, next) => next ?? prev,
    default: () => [],
  }),
  /** 与解析得到的规划行一一对应；workflow 中 `plan` 会随检索进度逐行追加，避免提前展示后续标题 */
  plan_titles: Annotation<string[]>({
    reducer: (prev, next) => next ?? prev,
    default: () => [],
  }),
  synthesis_context: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => "",
  }),
  /** 全部搜索结束后汇总的去重来源列表；供 synthesize 节点附到消息 additional_kwargs 持久化，前端渲染 inline citation */
  all_sources: Annotation<CitationSource[]>({
    reducer: (prev, next) => next ?? prev,
    default: () => [],
  }),
});
