# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js App Router pages and API routes (e.g. `app/api/chat/route.ts`, `app/api/web-search/route.ts`；前端 `app/(main)/web-search/` 对接工作流检索 SSE，`custom` 事件承载 workflow 快照；`steps[].items` 为扁平 `queries`/`sources`）。
- `components/`: UI and feature components (`components/chat`, `components/ai-elements`, `components/ui`).
- `lib/`: core logic and integrations (AI tooling, RAG, auth, DB, storage).
- `hooks/`: React hooks for client-side state and data access.
- `types/`: shared TypeScript types used across API and UI.
- `scripts/`: local utility scripts (for example agent stream/message checks).
- `docs/`: design and implementation plans.

## Build, Test, and Development Commands
- `pnpm dev`: run local development server with Turbopack.
- `pnpm build`: create production build.
- `pnpm start`: run production server from build output.
- `pnpm lint`: run ESLint checks.
- `pnpm format`: run Prettier across the repo; `pnpm format:check` for CI-style verification.
- Workspace `.vscode/settings.json` enables **format on save** with the [Prettier VS Code extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) (`esbenp.prettier-vscode`).
- `pnpm test:agent:message`: run `scripts/langchain-agent-message-test.mjs` to validate agent streaming behavior.
- `pnpm db:generate | db:migrate | db:push | db:studio`: manage Drizzle schema and database workflows.

## Coding Style & Naming Conventions
- Language: TypeScript (strict mode via `tsconfig.json`), React 19, Next.js 16.
- Indentation: 2 spaces; prefer explicit types for public interfaces and API payloads.
- Components: `PascalCase` filenames for feature components; hooks use `useXxx` naming.
- API logic: keep parsing/normalization helpers near route handlers for traceability.
- Prefer direct, flat code over nested wrappers and pass-through helper chains; if a function only forwards arguments once, inline or remove it.
- Avoid over-defensive compatibility code and redundant fallback branches unless they are required by a real data boundary or persistence contract.
- Normalization helpers should do one thing only: prefer simple type narrowing over hidden trimming, empty-value filtering, or extra shape rewriting.
- Prefer optional chaining and nullish coalescing (`?.`, `??`) for safe access and defaults.
- Minimize repetitive runtime type guards (for example frequent `typeof ...`) when data contracts are already trusted.
- Run `pnpm lint` before pushing; follow existing ESLint/Next rules in `eslint.config.mjs`.

## Testing Guidelines
- No full unit-test suite is currently enforced; lint and focused script-based verification are required.
- Validate critical chat flows by running:
  - `pnpm lint`
  - `pnpm test:agent:message`
- For API/streaming changes, verify both live stream behavior and persisted conversation rendering.

## Commit & Pull Request Guidelines
- Follow Conventional Commit style seen in history:
  - `feat(chat): ...`
  - `refactor(chat): ...`
- Keep commits scoped to one concern (UI, API, or data layer).
- PRs should include:
  - concise problem/solution summary,
  - impacted paths (e.g. `app/api/chat/route.ts`, `components/chat/chat-messages.tsx`),
  - screenshots/GIFs for UI changes,
  - manual verification steps and commands run.

## Security & Configuration Tips
- Never commit real secrets; use `.env.local` for local values and `.env.example` as template.
- Review auth- and DB-touching changes carefully (`lib/auth*`, `lib/db/*`, API routes) before merge.
