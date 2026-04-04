import {
  END,
  START,
  StateGraph,
  getConfig,
  getWriter,
  type BaseCheckpointSaver,
} from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import type { BaseMessage } from "@langchain/core/messages";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import {
  buildWebSearchChatOnlySystemPrompt,
  buildWebSearchPlanSystemPrompt,
  buildWebSearchSynthesisContextBlock,
  buildWebSearchSynthesisSystemPrompt,
} from "@/lib/ai/prompts";
import { parseWebSearchPlanFromLlmText } from "@/lib/ai/web-search-plan";
import {
  applyWorkflowAppendPlanRow,
  applyWorkflowAppendQuerySteps,
  applyWorkflowCompletePlanRowAndStep,
  applyWorkflowMarkRetrievalComplete,
  applyWorkflowMaterializeQuerySteps,
  applyWorkflowSearchFailure,
  applyWorkflowSearchStart,
  applyWorkflowSearchSuccess,
  applyWorkflowSetPlan,
  buildParallelWebSearchTasks,
  createInitialWebSearchWorkflowRoot,
  groupWebSearchTasksByPlanStep,
  readTasksFromQuerySteps,
  type ParallelWebSearchTask,
} from "@/lib/ai/web-search-workflow-state";
import {
  executeTavilyWebSearch,
  mergeTavilyItemsToCitations,
  normalizeWebSearchUrl,
  type TavilyRawItem,
} from "@/lib/ai/tools/web-search";
import { WebSearchGraphAnnotation } from "@/lib/ai/graphs/web-search-graph-state";
import type { CitationSource } from "@/lib/db/schema";

type BindableChatModel = ChatOpenAI | ChatAnthropic;

type CompileWebSearchAgentGraphOptions = {
  model: BindableChatModel;
  planModel: BindableChatModel;
  checkpointer: BaseCheckpointSaver;
};

function lastHumanText(messages: BaseMessage[]): string {
  const last = [...messages].reverse().find((m) => HumanMessage.isInstance(m));
  if (!last) return "";
  const c = last.content;
  return typeof c === "string" ? c : "";
}

function messageTextContent(msg: BaseMessage): string {
  const c = msg.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    return c
      .map((block) => {
        if (typeof block === "string") return block;
        if (block && typeof block === "object" && "text" in block) {
          const t = (block as { text?: unknown }).text;
          return typeof t === "string" ? t : "";
        }
        return "";
      })
      .join("");
  }
  return "";
}

function sourcesSubsetForRawItems(
  items: TavilyRawItem[],
  urlToSource: Map<string, CitationSource>
): CitationSource[] {
  const out: CitationSource[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const key = it.url.trim()
      ? normalizeWebSearchUrl(it.url)
      : normalizeWebSearchUrl(it.title);
    if (!key) continue;
    const s = urlToSource.get(key);
    if (s && !seen.has(key)) {
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}

/**
 * `plan`（仅写入第一步规划标题 + `plan_titles` / `search_tasks`）→ `search`（跨规划行串行；每行内 Tavily 并发；上一行结束后再追加下一行标题与关键词）→ `synthesize`。
 */
export function compileWebSearchAgentGraph({
  model,
  planModel,
  checkpointer,
}: CompileWebSearchAgentGraphOptions) {
  /** 根据 state.use_web_search（API 注入，对应前端 enableWebSearch）在边上分流至 plan 或跳过检索 */
  const webSearchGateNode = async () => ({});

  const planNode = async (state: typeof WebSearchGraphAnnotation.State) => {
    const text = lastHumanText(state.messages).trim();
    if (!text) return {};
    const planRaw = await planModel.invoke([
      new SystemMessage(buildWebSearchPlanSystemPrompt()),
      new HumanMessage(text),
    ]);
    const rawText = messageTextContent(planRaw as BaseMessage);
    const steps = parseWebSearchPlanFromLlmText(rawText, text);
    const fallbackLine = text.trim().slice(0, 200) || "检索";
    /** 与 steps 同长同序，供检索节点按规划行追加标题（勿 filter，避免与 group 下标错位） */
    const titleList = steps.map((s) => {
      const t = s.title.trim();
      return t.length > 0 ? t : fallbackLine;
    });
    const firstTitle = titleList[0] ?? fallbackLine;
    const workflow_root = applyWorkflowSetPlan(state.workflow_root, [
      { title: firstTitle },
    ]);
    const search_tasks = buildParallelWebSearchTasks(steps, text);
    getWriter(getConfig())?.(workflow_root);
    return { workflow_root, search_tasks, plan_titles: titleList };
  };


  const searchNode = async (state: typeof WebSearchGraphAnnotation.State) => {
    const cfg = getConfig();
    let workflow_root = state.workflow_root;
    const userText = lastHumanText(state.messages).trim();

    let tasks: ParallelWebSearchTask[] = state.search_tasks;
    const incremental = tasks.length > 0;

    if (!incremental) {
      tasks = readTasksFromQuerySteps(workflow_root.workflow_block.steps);
      if (
        tasks.length === 0 &&
        workflow_root.workflow_block.plan.length > 0 &&
        userText
      ) {
        workflow_root = applyWorkflowMaterializeQuerySteps(
          workflow_root,
          workflow_root.workflow_block.plan.map((p) => ({ title: p.title })),
          userText
        );
        tasks = readTasksFromQuerySteps(workflow_root.workflow_block.steps);
      }
    }

    const groups = groupWebSearchTasksByPlanStep(tasks);
    const mergeInputs: { items: TavilyRawItem[] }[] = [];
    const answerChunks: string[] = [];

    for (let g = 0; g < groups.length; g++) {
      const groupTasks = groups[g]!;
      const planStepIndex = groupTasks[0]!.planStepIndex;

      if (incremental) {
        if (g > 0) {
          const rowTitle =
            state.plan_titles[g]?.trim() ||
            groupTasks[0]!.title.trim() ||
            `步骤 ${planStepIndex}`;
          workflow_root = applyWorkflowAppendPlanRow(workflow_root, {
            title: rowTitle,
            index: planStepIndex,
          });
        }
        workflow_root = applyWorkflowAppendQuerySteps(workflow_root, groupTasks);
      }

      const orderedTasks = [...groupTasks].sort(
        (a, b) => a.searchIndex - b.searchIndex
      );
      /** ① 本规划行全部关键词已写入同一 step（QUERIES），检索尚未开始 */
      if (orderedTasks.length > 0) {
        getWriter(cfg)?.(workflow_root);
      }
      for (const task of orderedTasks) {
        workflow_root = applyWorkflowSearchStart(workflow_root, {
          searchIndex: task.workflowStepIndex,
          planStepIndex: task.planStepIndex,
          query: task.query,
          summary: task.title,
          maxResults: 1,
        });
      }

      const settled = await Promise.all(
        orderedTasks.map(async (task) => ({
          task,
          raw: await executeTavilyWebSearch(task.query, { maxResults: 1 }),
        }))
      );

      let groupPlanFailed = false;
      for (const { task, raw } of settled) {
        if (raw.ok) {
          mergeInputs.push({ items: raw.items });
          if (raw.answer) answerChunks.push(raw.answer);
        }

        const mergedSoFar = mergeTavilyItemsToCitations(mergeInputs);
        const urlToSource = new Map<string, CitationSource>();
        for (const s of mergedSoFar) {
          const key = s.url.trim()
            ? normalizeWebSearchUrl(s.url)
            : normalizeWebSearchUrl(s.fileName);
          if (key) urlToSource.set(key, s);
        }

        if (!raw.ok) {
          groupPlanFailed = true;
          workflow_root = applyWorkflowSearchFailure(workflow_root, {
            searchIndex: task.workflowStepIndex,
            planStepIndex: task.planStepIndex,
            message: raw.error,
          });
        } else {
          const subset = sourcesSubsetForRawItems(raw.items, urlToSource);
          workflow_root = applyWorkflowSearchSuccess(workflow_root, {
            searchIndex: task.workflowStepIndex,
            planStepIndex: task.planStepIndex,
            query: task.query,
            sources: subset,
            answer: raw.answer || undefined,
          });
        }
      }

      if (!groupPlanFailed && orderedTasks.length > 0) {
        const head = orderedTasks[0]!;
        workflow_root = applyWorkflowCompletePlanRowAndStep(workflow_root, {
          planStepIndex,
          workflowStepIndex: head.workflowStepIndex,
        });
      }
      /** ② 本规划行全部 Tavily 调用已结束（来源已合并或失败已写入） */
      if (orderedTasks.length > 0) {
        getWriter(cfg)?.(workflow_root);
      }
    }

    const mergedSources = mergeTavilyItemsToCitations(mergeInputs);
    const tavilyAnswers = answerChunks;

    workflow_root = applyWorkflowMarkRetrievalComplete(workflow_root);

    /** 全部检索完成后一次性推送汇总来源，前端据此渲染 inline citation */
    getWriter(cfg)?.({ intended_usage: "web_search_sources", sources: mergedSources });
    getWriter(cfg)?.(workflow_root);

    const synthesis_context = buildWebSearchSynthesisContextBlock({
      mergedSources,
      tavilyAnswers,
    });

    return { workflow_root, synthesis_context, all_sources: mergedSources };
  };

  const skipWebSearchNode = async () => {
    const cfg = getConfig();
    /** 勿沿用 checkpoint 里上一轮联网检索的 plan/steps，否则关闭联网仍会刷出旧工作流 */
    const workflow_root = applyWorkflowMarkRetrievalComplete(
      createInitialWebSearchWorkflowRoot(),
    );
    getWriter(cfg)?.(workflow_root);
    return {
      workflow_root,
      synthesis_context: "",
      all_sources: [],
      search_tasks: [],
      plan_titles: [],
    };
  };

  const synthesizeNode = async (state: typeof WebSearchGraphAnnotation.State) => {
    const systemPrompt = state.use_web_search
      ? buildWebSearchSynthesisSystemPrompt(state.synthesis_context)
      : buildWebSearchChatOnlySystemPrompt();
    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      ...state.messages,
    ]);
    const text = messageTextContent(response as BaseMessage);
    const workflowSnapshot = structuredClone(state.workflow_root);
    const extraKwargs = {
      web_search_workflow: workflowSnapshot,
      web_search_sources: state.all_sources,
    };
    const merged = AIMessage.isInstance(response)
      ? new AIMessage({
          id: response.id,
          content: text,
          additional_kwargs: { ...response.additional_kwargs, ...extraKwargs },
        })
      : new AIMessage({ content: text, additional_kwargs: extraKwargs });
    return { messages: [merged] };
  };

  return new StateGraph(WebSearchGraphAnnotation)
    .addNode("web_search_gate", webSearchGateNode)
    .addNode("plan", planNode)
    .addNode("search", searchNode)
    .addNode("skip_web_search", skipWebSearchNode)
    .addNode("synthesize", synthesizeNode)
    .addEdge(START, "web_search_gate")
    .addConditionalEdges(
      "web_search_gate",
      (state) => (state.use_web_search ? "plan" : "skip_web_search"),
      ["plan", "skip_web_search"],
    )
    .addEdge("plan", "search")
    .addEdge("search", "synthesize")
    .addEdge("skip_web_search", "synthesize")
    .addEdge("synthesize", END)
    .compile({ checkpointer });
}
