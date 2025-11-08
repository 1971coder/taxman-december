# Tax/Accounting Manager — Offline BAS + Invoicing

Mono-repo scaffold for the AU-focused offline invoicing + BAS assistant described in `/docs`. Everything is TypeScript-first, SQLite-backed, and designed for Codex automation.

## Workspace Layout

```
docs/                    # BRD, Architecture, Roadmap, Prompts
app/backend/             # Express + Drizzle (better-sqlite3)
app/frontend/            # Vite + React + Tailwind + shadcn/ui
packages/api-types/      # Shared Zod schemas between FE/BE
```

## Getting Started

1. Install tools: [pnpm](https://pnpm.io/) and a recent Node 20 LTS build.
2. Install workspace deps:
   ```bash
   pnpm install
   ```
3. Configure the API:
   ```bash
   cd app/backend
   cp .env.example .env
   pnpm db:push # generates SQLite + migrations via drizzle-kit
   pnpm dev     # starts Express on :4000
   ```
4. Run the frontend in another terminal:
   ```bash
   cd app/frontend
   pnpm dev
   ```
5. Visit `http://localhost:5173` — Vite proxies `/api` to the backend.

## Useful Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Run all `dev` scripts in parallel (backend + frontend). |
| `pnpm dev:backend` / `pnpm dev:frontend` | Focused dev servers. |
| `pnpm lint` / `pnpm format` | Repo-wide linting + Prettier formatting. |
| `pnpm test` | Placeholder Vitest runs for all workspaces. |
| `pnpm db:push` | Sync Drizzle schema to SQLite via backend package. |

Refer to `docs/ROADMAP.md` for the recommended build order and `docs/CODEX_PROMPTS.md` for copy-pastable Codex presets. The Architect → Implement → Test → UI → Polish modes map directly onto this scaffold.
