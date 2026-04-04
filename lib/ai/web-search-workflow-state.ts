import { randomUUID } from "node:crypto";
import { createCitationSource, getSourceLink } from "@/lib/ai/source";
import { normalizeWebSearchUrl } from "@/lib/ai/tools/web-search";
import type { CitationSource } from "@/lib/db/schema";
import type { Source } from "@/types";

export type WorkflowStatus =
  | "WORKFLOW_IN_PROGRESS"
  | "WORKFLOW_COMPLETED"
  | "WORKFLOW_FAILED";

export type WorkflowStepStatus =
  | "WORKFLOW_STEP_PENDING"
  | "WORKFLOW_STEP_IN_PROGRESS"
  | "WORKFLOW_COMPLETED"
  | "WORKFLOW_FAILED";

export type WorkflowSourcePayload = Source;

export type WorkflowStepItem =
  | {
      type: "WORKFLOW_ITEM_QUERIES";
      queries: string[];
    }
  | {
      type: "WORKFLOW_ITEM_SOURCES";
      sources: WorkflowSourcePayload[];
    };

export type WorkflowStep = {
  status: WorkflowStepStatus;
  title: string;
  /** 对应规划行号（1-based），便于 UI 按 plan 聚合多关键词检索 */
  plan_step_index?: number;
  items: WorkflowStepItem[];
};

/** 规划节点写入：每步标题；检索词仅存于 `steps[].items` 的 QUERIES。 */
export type WorkflowPlanStepStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "SKIPPED";

export type WorkflowPlanStep = {
  id: string;
  index: number;
  title: string;
  status: WorkflowPlanStepStatus;
};

export type WebSearchWorkflowRoot = {
  intended_usage: "workflow_root";
  workflow_block: {
    status: WorkflowStatus;
    plan: WorkflowPlanStep[];
    steps: WorkflowStep[];
  };
};

/** 与 `parseWebSearchPlanFromLlmText` 行结构一致（展开检索任务用） */
export type PlanParseRow = {
  title: string;
  suggested_queries?: string[];
};

export type ParallelWebSearchTask = {
  /** 全局 Tavily 调用顺序（合并上下文） */
  searchIndex: number;
  /** `workflow_block.steps` 的 1-based 下标；同一规划行多关键词共享一步 */
  workflowStepIndex: number;
  planStepIndex: number;
  query: string;
  title: string;
};

/**
 * 由规划解析结果展开并行检索任务：每行最多取 3 条 suggested_queries，无则仅用 title；全局按 query 去重（保留首次出现的规划行）。
 */
export function buildParallelWebSearchTasks(
  plan: PlanParseRow[],
  fallbackQuery: string
): ParallelWebSearchTask[] {
  const seen = new Set<string>();
  const tasks: ParallelWebSearchTask[] = [];
  let searchIndex = 0;

  for (let i = 0; i < plan.length; i++) {
    const step = plan[i];
    const planStepIndex = i + 1;
    const qs =
      step.suggested_queries && step.suggested_queries.length > 0
        ? step.suggested_queries
            .map((q) => q.trim())
            .filter(Boolean)
            .slice(0, 3)
        : [step.title.trim() || fallbackQuery.trim()].filter(Boolean);

    for (const q of qs) {
      if (!q) continue;
      const key = q.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      searchIndex += 1;
      tasks.push({
        searchIndex,
        workflowStepIndex: planStepIndex,
        planStepIndex,
        query: q,
        title: step.title.trim() || q,
      });
    }
  }

  if (tasks.length === 0 && fallbackQuery.trim()) {
    tasks.push({
      searchIndex: 1,
      workflowStepIndex: 1,
      planStepIndex: 1,
      query: fallbackQuery.trim(),
      title: plan[0]?.title?.trim() || "检索",
    });
  }

  return tasks;
}

/**
 * 从已物化的 `workflow_block.steps`（含 QUERIES 项）还原并行任务，供 search 节点执行。
 */
export function readTasksFromQuerySteps(steps: WorkflowStep[]): ParallelWebSearchTask[] {
  const out: ParallelWebSearchTask[] = [];
  let searchIndex = 0;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const qItem = step.items.find((it) => it.type === "WORKFLOW_ITEM_QUERIES");
    const rawQs = qItem?.queries ?? [];
    const queries = (
      rawQs.length > 0
        ? rawQs.map((q) => q.trim()).filter(Boolean)
        : [step.title.trim()].filter(Boolean)
    ).slice(0, 3);
    const workflowStepIndex = i + 1;
    const planStep = step.plan_step_index ?? workflowStepIndex;
    for (const q of queries) {
      searchIndex += 1;
      out.push({
        searchIndex,
        workflowStepIndex,
        planStepIndex: planStep,
        query: q,
        title: step.title.trim() || q,
      });
    }
  }
  return out;
}

/** 按规划行序号分组，组内顺序与 `tasks` 中出现顺序一致。 */
export function groupWebSearchTasksByPlanStep(
  tasks: ParallelWebSearchTask[]
): ParallelWebSearchTask[][] {
  const map = new Map<number, ParallelWebSearchTask[]>();
  for (const t of tasks) {
    const list = map.get(t.planStepIndex);
    if (list) list.push(t);
    else map.set(t.planStepIndex, [t]);
  }
  return [...map.keys()]
    .sort((a, b) => a - b)
    .map((k) => map.get(k)!);
}

function sourceFromCitation(s: CitationSource): WorkflowSourcePayload {
  return s;
}

function workflowSourceDedupeKey(s: WorkflowSourcePayload): string {
  const link = getSourceLink(s)?.trim();
  return link ? normalizeWebSearchUrl(link) : normalizeWebSearchUrl(s.fileName);
}

/** 按 URL（或标题归一化）去重合并，保持首次出现顺序。 */
function mergeWorkflowSourcesPayload(
  existing: WorkflowSourcePayload[],
  incoming: WorkflowSourcePayload[]
): WorkflowSourcePayload[] {
  const seen = new Set<string>();
  const out: WorkflowSourcePayload[] = [];
  for (const s of [...existing, ...incoming]) {
    const k = workflowSourceDedupeKey(s);
    if (!k) {
      out.push(s);
      continue;
    }
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

export function createInitialWebSearchWorkflowRoot(): WebSearchWorkflowRoot {
  return {
    intended_usage: "workflow_root",
    workflow_block: {
      status: "WORKFLOW_IN_PROGRESS",
      plan: [],
      steps: [],
    },
  };
}

function stepAt(
  root: WebSearchWorkflowRoot,
  searchIndex: number
): WorkflowStep | undefined {
  return root.workflow_block.steps[searchIndex - 1];
}

function planStepAt(
  root: WebSearchWorkflowRoot,
  searchIndex: number
): WorkflowPlanStep | undefined {
  return root.workflow_block.plan[searchIndex - 1];
}

export function applyWorkflowSetPlan(
  root: WebSearchWorkflowRoot,
  planTitles: Array<{ title: string }>
): WebSearchWorkflowRoot {
  const next = structuredClone(root);
  /** 新一轮用户提问时重置执行步骤，避免继承上一轮 checkpoint 中的 steps */
  next.workflow_block.steps = [];
  /** 否则上一轮 `WORKFLOW_COMPLETED` 会残留，前端误判检索已结束、思维链无法展开 */
  next.workflow_block.status = "WORKFLOW_IN_PROGRESS";
  next.workflow_block.plan = planTitles.map((s, i) => ({
    id: randomUUID(),
    index: i + 1,
    title: s.title.trim(),
    status: "PENDING" as const,
  }));
  return next;
}

/** 上一规划行结束后追加下一行（仅披露标题；index 与任务 `planStepIndex` 一致，1-based）。 */
export function applyWorkflowAppendPlanRow(
  root: WebSearchWorkflowRoot,
  args: { title: string; index: number }
): WebSearchWorkflowRoot {
  const next = structuredClone(root);
  next.workflow_block.plan.push({
    id: randomUUID(),
    index: args.index,
    title: args.title.trim(),
    status: "PENDING" as const,
  });
  return next;
}

/** 将 LLM 解析得到的行（含 suggested_queries）展开为仅含 QUERIES 的占位 steps，供检索与 UI 读取。 */
export function applyWorkflowMaterializeQuerySteps(
  root: WebSearchWorkflowRoot,
  parsed: Array<{ title: string; suggested_queries?: string[] }>,
  fallbackQuery: string
): WebSearchWorkflowRoot {
  const next = structuredClone(root);
  const tasks = buildParallelWebSearchTasks(parsed, fallbackQuery);
  const groups = groupWebSearchTasksByPlanStep(tasks);
  next.workflow_block.steps = groups.map((group) => {
    const head = group[0]!;
    return {
      status: "WORKFLOW_STEP_PENDING" as const,
      title: head.title,
      plan_step_index: head.planStepIndex,
      items: [
        {
          type: "WORKFLOW_ITEM_QUERIES" as const,
          queries: group.map((t) => t.query),
        },
      ],
    };
  });
  return next;
}

/** 在 workflow 末尾追加一条检索 step（仅 QUERIES），同一规划行内多关键词写入 `queries` 数组。 */
export function applyWorkflowAppendQuerySteps(
  root: WebSearchWorkflowRoot,
  tasks: ParallelWebSearchTask[]
): WebSearchWorkflowRoot {
  if (tasks.length === 0) return root;
  const next = structuredClone(root);
  const head = tasks[0]!;
  next.workflow_block.steps.push({
    status: "WORKFLOW_STEP_PENDING",
    title: head.title,
    plan_step_index: head.planStepIndex,
    items: [
      {
        type: "WORKFLOW_ITEM_QUERIES",
        queries: tasks.map((t) => t.query),
      },
    ],
  });
  return next;
}

/** 标记规划行与对应 step 进入执行中（step 已在 materialize 中创建）。 */
export function applyWorkflowSearchStart(
  root: WebSearchWorkflowRoot,
  args: {
    searchIndex: number;
    planStepIndex?: number;
    query: string;
    summary?: string;
    maxResults?: number;
  }
): WebSearchWorkflowRoot {
  const next = structuredClone(root);
  const planRow = args.planStepIndex ?? args.searchIndex;
  const planned = planStepAt(next, planRow);
  if (planned) {
    planned.status = "IN_PROGRESS";
  }

  const step = stepAt(next, args.searchIndex);
  if (step) {
    step.status = "WORKFLOW_STEP_IN_PROGRESS";
    if (args.summary?.trim()) {
      step.title = args.summary.trim().slice(0, 200);
    }
  }
  void args.query;
  void args.maxResults;
  return next;
}

export function applyWorkflowSearchSuccess(
  root: WebSearchWorkflowRoot,
  args: {
    searchIndex: number;
    planStepIndex?: number;
    query: string;
    sources: CitationSource[];
    answer?: string;
  }
): WebSearchWorkflowRoot {
  const next = structuredClone(root);
  const step = stepAt(next, args.searchIndex);
  if (!step) return next;
  const incoming = args.sources.map(sourceFromCitation);
  const srcItem = step.items.find((it) => it.type === "WORKFLOW_ITEM_SOURCES");
  if (srcItem) {
    srcItem.sources = mergeWorkflowSourcesPayload(srcItem.sources, incoming);
  } else {
    step.items.push({
      type: "WORKFLOW_ITEM_SOURCES",
      sources: incoming,
    });
  }
  void args.answer;
  void args.query;
  void args.planStepIndex;
  return next;
}

/** 同一规划行内全部关键词检索成功后，标记规划行与对应 step 完成。 */
export function applyWorkflowCompletePlanRowAndStep(
  root: WebSearchWorkflowRoot,
  args: { planStepIndex: number; workflowStepIndex: number }
): WebSearchWorkflowRoot {
  const next = structuredClone(root);
  const planned = planStepAt(next, args.planStepIndex);
  if (planned) planned.status = "COMPLETED";
  const step = stepAt(next, args.workflowStepIndex);
  if (step) step.status = "WORKFLOW_COMPLETED";
  return next;
}

export function applyWorkflowSearchFailure(
  root: WebSearchWorkflowRoot,
  args: { searchIndex: number; planStepIndex?: number; message: string }
): WebSearchWorkflowRoot {
  const next = structuredClone(root);
  const planRow = args.planStepIndex ?? args.searchIndex;
  const planned = planStepAt(next, planRow);
  if (planned) {
    planned.status = "FAILED";
  }
  const step = stepAt(next, args.searchIndex);
  if (!step) return next;
  const errRow: WorkflowSourcePayload = createCitationSource({
    source: "web",
    index: args.searchIndex,
    documentId: `error:${args.searchIndex}`,
    fileName: "检索未返回可用结果",
    chunkIndex: 0,
    content: args.message,
    url: "",
  });
  const srcItem = step.items.find((it) => it.type === "WORKFLOW_ITEM_SOURCES");
  if (srcItem) {
    srcItem.sources = mergeWorkflowSourcesPayload(srcItem.sources, [errRow]);
  } else {
    step.items.push({
      type: "WORKFLOW_ITEM_SOURCES",
      sources: [errRow],
    });
  }
  step.status = "WORKFLOW_FAILED";
  return next;
}

/**
 * 并行检索全部处理完毕后调用（早于 synthesize）。
 * 将 `workflow_block.status` 置为 `WORKFLOW_COMPLETED` 并通过 LangGraph `custom` 下发，
 * 前端即可据此收起思维链，无需等到正文 `messages` 流结束或路由 `finally`。
 */
export function applyWorkflowMarkRetrievalComplete(
  root: WebSearchWorkflowRoot
): WebSearchWorkflowRoot {
  const next = structuredClone(root);
  next.workflow_block.status = "WORKFLOW_COMPLETED";
  return next;
}

export function applyWorkflowFinalize(
  root: WebSearchWorkflowRoot,
  ok: boolean
): WebSearchWorkflowRoot {
  const next = structuredClone(root);
  next.workflow_block.status = ok ? "WORKFLOW_COMPLETED" : "WORKFLOW_FAILED";
  return next;
}
