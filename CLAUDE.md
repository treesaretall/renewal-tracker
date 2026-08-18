# Renewal Tracker

## Project

Renewal and bill deadline tracker built as an npm workspaces monorepo. apps/web is a Vite + React 19 + TypeScript frontend. apps/api is an Express 5 + Prisma 7 + SQLite backend. packages/shared contains Zod schemas and pure domain logic shared by both apps.

## Hard rules

- TypeScript strict everywhere. No `any`, no non-null `!` assertions, no `as` casts to silence errors — fix the type instead. `unknown` + a Zod parse at boundaries.
- Date-only values are `YYYY-MM-DD` strings, never Date objects. Only code inside packages/shared/src/domain may construct a Date, and only to call date-fns.
- Never read the current time inside domain logic. `today: string` is always a parameter.
- Renewal status is always derived via computeStatus(). Never stored in the DB.
- Every API request and response body is validated by a Zod schema from packages/shared. Client-side types come from `z.infer`, never hand-written duplicates.
- Money is integer cents (`costCents`), never a float.
- Server entity data lives in TanStack Query. Zustand holds UI state only (filters, view mode, dialog state). Never mirror server data into Zustand.
- Colocate tests as `*.test.ts(x)` next to the source file.
- Every reusable component in components/ui and components/renewals gets a `*.stories.tsx`.

## Version gotchas — do not use older patterns from memory

- Tailwind v4: no tailwind.config.js, no PostCSS. `@tailwindcss/vite` plugin + `@import "tailwindcss";` in CSS. Theme customisation via `@theme {}` in CSS.
- React Router v7: `createBrowserRouter` from "react-router"; `RouterProvider` from "react-router/dom". react-router-dom is not installed.
- Prisma 7: generator `provider = "prisma-client"` with explicit `output`. Import PrismaClient from the generated output path, not "@prisma/client". datasource has no `url` — connection is in prisma.config.ts and PrismaClient needs a driver adapter.
- Storybook 10: `@storybook/react-vite`, `@storybook/addon-vitest`, `@storybook/addon-a11y`.
- Express 5: rejected async handlers reach error middleware automatically.

## Commands

Root scripts delegate to workspaces via `npm run <script> -w <workspace>`.

| Command              | Description                                        |
| -------------------- | -------------------------------------------------- |
| `npm run dev`        | Start both API and web servers in parallel         |
| `npm run dev:api`    | Start API server only                              |
| `npm run dev:web`    | Start web dev server only                          |
| `npm run build`      | Build shared package, then API and web in parallel |
| `npm run typecheck`  | Type-check all workspaces                          |
| `npm run test`       | Run unit tests in all workspaces                   |
| `npm run test:e2e`   | Run Playwright end-to-end tests                    |
| `npm run lint`       | Lint all files with ESLint                         |
| `npm run lint:fix`   | Lint and auto-fix issues                           |
| `npm run format`     | Format all files with Prettier                     |
| `npm run format:check` | Check formatting without changes                   |
