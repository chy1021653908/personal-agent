# Personal Agent

一个面向实用场景的 AI 知识助手：对话、文档问答、联网检索一体化。

[English](./README.md) | 中文文档

## 项目能做什么

Personal Agent 可以帮助你：

- 与 AI 助手进行多轮对话
- 上传私有文档并基于文档进行问答
- 使用工作流方式进行联网检索
- 通过知识库与文件夹管理内容
- 持久化保存会话与检索上下文

## 核心功能

### 1) AI 对话助手

- 流式输出回复，交互更顺滑
- 支持多轮会话与历史管理
- 在可用时展示来源引用信息

### 2) 知识库问答（RAG）

- 支持创建多个知识库
- 支持文件夹层级组织
- 支持常见文档格式：PDF、TXT、Markdown、DOCX、XLSX
- 自动完成索引与检索，提升回答准确性

### 3) 联网检索工作流（LangGraph）

- 面向复杂问题的分步骤检索流程
- 可视化展示规划、检索、综合阶段
- 汇总来源后生成最终回答

### 4) 账号与权限

- 支持邮箱密码登录
- 支持 Google 登录
- 用户数据隔离

### 5) 产品体验

- 支持中英文界面切换（`中文` / `English`）
- 响应式布局
- 删除等危险操作二次确认

## 典型使用流程

1. 登录后创建知识库  
2. 上传文档并等待索引完成  
3. 在对话中提问，获得基于文档的回答  
4. 需要最新信息时切换到联网检索  
5. 在同一会话中继续追问

## 快速开始

### 环境要求

- Node.js 22+
- pnpm 9+
- PostgreSQL
- Chroma

### 安装依赖

```bash
pnpm install
```

### 配置环境变量

```bash
cp .env.example .env.local
```

### 初始化数据库

```bash
pnpm db:push
```

### 启动开发服务

```bash
pnpm dev
```

打开 `http://localhost:3000`。

## 环境变量（高层说明）

你需要准备以下配置：

- 鉴权相关配置
- 数据库连接
- 文件存储凭据
- 向量数据库连接
- LLM 提供商密钥
- （可选）联网检索密钥

完整变量列表见 `.env.example`。

## 常用脚本

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm format
pnpm db:generate
pnpm db:migrate
pnpm db:push
pnpm db:studio
```

## License

MIT
