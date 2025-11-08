# CODEX PROMPTS — Ready to Paste

## 1) Architect Mode (High Reasoning)
Role: principal architect. Read `docs/ARCHITECTURE.md`, `docs/BRD.md`, and `docs/ROADMAP.md` before acting.

Mission: design the initial scaffolding for the mono-repo so the next mode can implement confidently. Keep everything offline-first, TypeScript-only, and aligned with the repository layout in `docs/ARCHITECTURE.md`.

What to reason through (call out assumptions explicitly):
1. Workspace plan: package manager, workspace `package.json`, shared scripts, lint/test tooling.
2. Backend scaffold: Express entrypoint, routing folders, Drizzle config, SQLite location, Zod helpers, and how migrations will run.
3. Frontend scaffold: Vite + React + Tailwind + shadcn/ui skeleton, global providers (TanStack Query, RHF, Zod), and the page tree.
4. Data layer: Drizzle schema stubs for every table listed, plus the BAS period helper that snaps to AU financial years (Jul–Jun) and supports monthly/quarterly.
5. Integration points: how frontend talks to backend (API client, types), and any shared types packages.

Return in Markdown with:
- `Architecture Notes` — bullet summary of key decisions and open questions.
- `Commit Plan` — ordered list of commits/steps to scaffold root, backend, frontend, and database helpers.
- `Files to Create` — table listing each new file/directory with a one-line description (no code yet, just intent).

## 2) Implement Mode (Medium Reasoning) — Invoicing Autofill
Implement `resolveRate(clientId, employeeId, issueDate)` and wire it into `POST /api/invoices`.
Rules: client-rate effective on `issueDate` wins; else employee default; else reject with 400.

## 3) Test Mode (Medium Reasoning)
Write Vitest for:
- rate resolver (overlap, edges, fallback)
- FY generator (monthly/quarterly options for FY 2025–26)
- BAS compute (cash vs accrual small fixtures)

## 4) UI Mode (Medium Reasoning) — Invoice Form
Build a form with RHF + Zod:
- Client (required) → caches client rates.
- Line rows with Employee selector → autofill rate; “overridden” chip when user edits.
- Totals ex/GST/inc live; Save disabled if unresolved rate.

## 5) Polish Mode (Low/Medium)
Add Tailwind base, a shadcn/ui Card around forms, and simple toasts for saves.
