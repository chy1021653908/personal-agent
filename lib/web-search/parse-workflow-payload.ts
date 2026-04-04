import { toSource } from "@/lib/ai/source";
import type {
  WebSearchWorkflowRoot,
  WorkflowPlanStep,
  WorkflowStep,
  WorkflowStatus,
} from "@/lib/ai/web-search-workflow-state";
import type { CitationSource } from "@/lib/db/schema";
import type { Source } from "@/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseWorkflowItems(raw: unknown): WorkflowStep["items"] {
  const items: WorkflowStep["items"] = [];
  if (!Array.isArray(raw)) return items;

  for (const item of raw) {
    if (!isRecord(item) || typeof item.type !== "string") continue;

    if (item.type === "WORKFLOW_ITEM_QUERIES" && Array.isArray(item.queries)) {
      items.push({
        type: "WORKFLOW_ITEM_QUERIES",
        queries: item.queries.filter(
          (query): query is string =>
            typeof query === "string" && query.trim().length > 0,
        ),
      });
      continue;
    }

    if (item.type === "WORKFLOW_ITEM_SOURCES" && Array.isArray(item.sources)) {
      items.push({
        type: "WORKFLOW_ITEM_SOURCES",
        sources: item.sources
          .map((source) => toSource(source))
          .filter((source): source is Source => source !== null),
      });
    }
  }

  return items;
}

/**
 * 解析 `web_search_sources` custom 事件 payload，返回来源数组；不符合格式时返回 null。
 */
export function parseWebSearchSourcesCustomPayload(
  data: unknown,
): CitationSource[] | null {
  if (!isRecord(data)) return null;
  if (data.intended_usage !== "web_search_sources") return null;
  if (!Array.isArray(data.sources)) return null;

  const sources = data.sources
    .map((source) => toSource(source))
    .filter((source): source is CitationSource => source !== null);

  return sources.length > 0 ? sources : null;
}

/**
 * 解析 `/api/web-search` `custom` 事件 payload；补全缺省字段与无 `plan` 的响应。
 */
export function parseWebSearchWorkflowCustomPayload(
  data: unknown
): WebSearchWorkflowRoot | null {
  if (!isRecord(data)) return null;
  if (data.intended_usage !== "workflow_root") return null;
  const wb = data.workflow_block;
  if (!isRecord(wb)) return null;
  if (!Array.isArray(wb.steps)) return null;

  const status = wb.status;
  const safeStatus: WorkflowStatus =
    status === "WORKFLOW_IN_PROGRESS" ||
    status === "WORKFLOW_COMPLETED" ||
    status === "WORKFLOW_FAILED"
      ? status
      : "WORKFLOW_IN_PROGRESS";

  const steps: WorkflowStep[] = wb.steps.map((step) => {
    if (!isRecord(step)) {
      return {
        status: "WORKFLOW_STEP_PENDING",
        title: "",
        items: [],
      };
    }

    const items = parseWorkflowItems(step.items);

    return {
      status:
        step.status === "WORKFLOW_STEP_IN_PROGRESS" ||
        step.status === "WORKFLOW_COMPLETED" ||
        step.status === "WORKFLOW_FAILED"
          ? step.status
          : "WORKFLOW_STEP_PENDING",
      title: typeof step.title === "string" ? step.title : "",
      plan_step_index:
        typeof step.plan_step_index === "number"
          ? step.plan_step_index
          : undefined,
      items,
    };
  });

  return {
    intended_usage: "workflow_root",
    workflow_block: {
      status: safeStatus,
      plan: Array.isArray(wb.plan) ? (wb.plan as WorkflowPlanStep[]) : [],
      steps,
    },
  };
}
