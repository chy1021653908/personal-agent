# Personal Agent - AI 知识库助手

基于 RAG（检索增强生成）的智能对话系统，支持多格式文档上传、向量化检索和流式 AI 对话。

## 技术栈

- **框架**: Next.js 15 (App Router) + TypeScript
- **样式**: Tailwind CSS v4 + shadcn/ui
- **鉴权**: Better Auth (email/password)
- **数据库**: Supabase PostgreSQL + Drizzle ORM
- **文件存储**: Supabase Storage
- **向量数据库**: Chroma
- **LLM**: Vercel AI SDK (`@ai-sdk/openai`, `@ai-sdk/anthropic`)
- **RAG**: LangChain TextSplitters + AI SDK Embedding + Chroma 向量检索

## 功能

- 用户注册/登录（Better Auth）
- 知识库管理（创建/删除/编辑）
- 文件夹组织结构
- 多格式文档上传（PDF, TXT, Markdown, DOCX, XLSX）
- 文档向量化处理（分割/嵌入/存储）
- 基于知识库的智能对话（RAG）
- 流式 AI 回复 + 来源引用标注
- 对话历史管理

## 快速开始

### 0. 环境要求

- Node.js 22（推荐使用 nvm：`nvm use` 或 `nvm install`）
- pnpm

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local`，填入实际配置：

```bash
cp .env.example .env.local
```

### 3. 初始化数据库

```bash
pnpm run db:push
```

### 4. 启动开发服务器

```bash
pnpm run dev
```

访问 http://localhost:3000

## 项目结构

```
app/                    # Next.js App Router 页面
  (auth)/               # 登录/注册页面
  (main)/               # 主应用页面（对话/知识库）
  api/                  # API 路由
components/             # UI 组件
  auth/                 # 认证组件
  chat/                 # 对话组件
  knowledge/            # 知识库组件
  ui/                   # shadcn/ui 基础组件
lib/                    # 核心库
  ai/                   # LLM 提供者和提示词
  db/                   # Drizzle ORM 数据库
  rag/                  # RAG 管线（加载/分割/嵌入/检索）
  supabase/             # Supabase 客户端和存储
hooks/                  # React Hooks
types/                  # TypeScript 类型定义
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `BETTER_AUTH_SECRET` | Better Auth 密钥 (≥32字符) |
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key |
| `AI_GATEWAY_API_KEY` | [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) Key（在 Vercel 控制台创建） |
| `CHROMA_API_URL` | Chroma 服务器地址 |
