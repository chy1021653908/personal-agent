# Personal Agent

An AI knowledge assistant for team and personal use, built for practical workflows:
chat, document-grounded answers, and web research.

[中文文档](./README.zh-CN.md) | English

## What It Does

Personal Agent helps you:

- chat with an AI assistant in a multi-turn conversation
- upload your own files and ask questions grounded in those files
- run a guided web-search workflow for up-to-date topics
- organize content with knowledge bases and folders
- keep conversation and retrieval context persistent across sessions

## Key Features

### 1) AI Chat Assistant

- clean chat interface with streaming responses
- conversation history management
- source-aware answers (with citation hints when available)

### 2) Knowledge Base (RAG)

- create multiple knowledge bases
- organize documents with folder hierarchy
- upload common formats: PDF, TXT, Markdown, DOCX, XLSX
- automatic indexing and retrieval for grounded Q&A

### 3) Web Research Workflow (LangGraph)

- step-based search workflow for complex questions
- visible progress during planning/search/synthesis
- merged sources for final answer generation

### 4) Account & Access

- email/password authentication
- Google login support
- user-level data isolation

### 5) Product Experience

- bilingual UI (`English` / `中文`)
- responsive layout for daily use
- confirmation dialogs for destructive actions

## Typical User Journey

1. Sign in and create a knowledge base  
2. Upload documents and wait for indexing  
3. Ask questions in chat (grounded by your knowledge base)  
4. Switch to web research when you need live internet information  
5. Continue multi-turn follow-up questions in the same thread

## Quick Start

### Requirements

- Node.js 22+
- pnpm 9+
- PostgreSQL
- Chroma

### Install

```bash
pnpm install
```

### Configure

```bash
cp .env.example .env.local
```

### Initialize DB

```bash
pnpm db:push
```

### Run

```bash
pnpm dev
```

Open `http://localhost:3000`.

## Environment Setup (High-Level)

You need to provide:

- auth configuration
- database connection
- storage credentials
- vector database connection
- LLM provider key(s)
- optional web-search key

All variables are listed in `.env.example`.

## Scripts

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
