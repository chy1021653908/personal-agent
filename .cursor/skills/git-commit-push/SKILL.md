---
name: git-commit-push
description: Guides committing and pushing in this repo with concise Chinese Conventional Commit messages. Use when the user asks to commit, push, 提交代码, 推送, generate a git message, or finish a PR-ready snapshot.
---

# Git 提交与推送（本仓库）

## 何时使用

用户要求提交、推送、写 commit message、或「把改动推上去」时按本流程执行。

## 提交前检查

1. `git status`：确认要纳入提交的文件；若有未暂存改动且用户要「全部提交」，先 `git add -A`（或按用户指定路径 add）。
2. `git diff --stat` / `git diff --cached --stat`：把握变更范围，便于写准确的 subject。

## Commit message 规则（与 `AGENTS.md` 一致）

- **语言**：标题与正文使用**中文**，**简明扼要**。
- **格式**：Conventional Commits，例如 `feat(scope): …`、`fix(chat): …`、`refactor(api): …`。
- **标题（第一行）**：一句话说清「做了什么」，≤72 字为宜，避免堆砌文件名。
- **正文（可选）**：仅当多模块混杂或需要说明验证方式时加空行后写 1～3 行要点；否则单行提交即可。

## 推荐流程

```bash
git status
git add -A   # 若需要
git commit -m "feat(web-search): 简短中文标题" -m "可选：补充说明一行"
git push
```

## 多主题混杂时

若一次 `git status` 里同时有互不相关的大改动，**优先询问用户**是否拆成多次提交；用户坚持一次提交时，subject 用更上层的概括，body 列出主要模块（如：工作流检索、聊天 API、依赖）。

## 示例

**单功能：**

```
feat(web-search): 汇总来源推送、[N] 内联引文与 Avatar 参考文献

同步聊天流、web-search-body 与 LangChain 示例模型及依赖
```

**小修复：**

```
fix(chat): 修复流式消息在刷新后顺序错乱
```

## 注意

- 勿在 message 中泄露密钥或 `.env` 内容。
- `git push` 前确认当前分支；默认推送到已跟踪的 `origin` 分支。
