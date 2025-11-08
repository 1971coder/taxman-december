# Project Context — Taxman Manager (Offline BAS + Invoicing)

_Last updated: 2024-12-27_

## 1. Mission & Scope
Offline-first tooling for AU accountants to manage company settings, client/employee masters, client-specific rate cards, invoices (with autofilled rates), expenses, and BAS prep. All data lives in a local SQLite database; no cloud dependencies or external APIs.

## 2. Current Implementation Snapshot
We have completed Sprints 1–5 from `docs/ROADMAP.md`:
- **Workspace:** pnpm monorepo with `app/backend`, `app/frontend`, `packages/api-types`.
- **Shared contracts:** `packages/api-types` exports Zod schemas/types used by both apps.
- **Backend:** Express + Drizzle (better-sqlite3). Routes implemented for settings, GST codes, clients, employees, client rates (with overlap guard), invoices (includes `resolveRate` and sum/gst math), and expenses. BAS helpers include FY period generator and a stub `computeBasSummary`.
- **Frontend:** Vite + React + Tailwind + shadcn-style primitives. TanStack Query + RHF/Zod used across settings, GST codes, clients, employees, client rates, invoices, and expenses pages.
- **Validation:** All APIs parse payloads via shared Zod schemas before touching the DB.
- **Tooling:** Strict TS (`NodeNext`/`Bundler` resolution where appropriate), ESLint flat config, Prettier, Vitest placeholders. `pnpm dev` runs both apps; `pnpm db:push` syncs Drizzle schema to SQLite.

Remaining roadmap work:
1. **Sprint 6 (BAS Worksheet):** build FY generator UI, compute BAS summary (cash/accrual), and report endpoints/UI.
2. **Sprint 7 (Data I/O):** CSV import/export + SQLite backup helpers (optional for MVP).

## 3. Architecture & Layout
```
docs/                   # BRD, ARCHITECTURE, ROADMAP, prompts, context
packages/api-types/     # Shared Zod schemas (settings, clients, employees, rates, invoices, expenses, BAS)
app/backend/
  src/index.ts          # Express bootstrap
  src/routes/*.ts       # Feature routers (settings, gst-codes, clients, employees, client-rates, invoices, expenses, reports)
  src/services/         # Business helpers (rates resolver, BAS periods/compute)
  src/db/               # Drizzle schema + client + migrations config
app/frontend/
  src/main.tsx          # React providers (Router, QueryClient, Toaster)
  src/app.tsx           # Shell + nav
  src/lib/              # `apiFetch`, TanStack Query client
  src/components/       # shadcn-style UI + RHF forms
  src/pages/            # Feature screens (dashboard, clients, employees, invoices, expenses, reports, settings)
```

Backend uses better-sqlite3 with Drizzle ORM and a shared SQLite file at `app/backend/db/sqlite/app.db`. Frontend proxies `/api` to `localhost:4000`.

## 4. Data Model & Helpers
Implemented tables (Drizzle schema):
- `company_settings`, `gst_codes`
- `clients`, `employees`, `client_rates`
- `invoices`, `invoice_items`, `receipts`, `receipt_allocations`
- `expenses`, `tax_periods`, `bas_runs`, `exceptions`

Key helpers:
- `resolveRate(clientId, employeeId, issueDate)` — picks client-specific rate effective on issue date, otherwise employee base rate.
- `generateBasPeriods` — monthly/quarterly FY windows aligned to AU Jul–Jun.
- `computeBasSummary` — aggregates invoice/expense totals for a given period (ready to wire into `/api/reports/bas`).

## 5. API Surface (implemented)
| Endpoint | Notes |
| --- | --- |
| `GET/PUT /api/settings` | Company + BAS configuration (single-row table). |
| `GET/POST /api/gst-codes` | Manage GST codes/rates. |
| `GET/POST /api/clients` | Basic client master with default rate cents + conflict guard on display name. |
| `GET/POST /api/employees` | Employee defaults (unit, base rate). |
| `GET /api/client-rates?clientId=` / `POST /api/client-rates` | Effective-dated client rate cards; overlaps blocked per employee. |
| `GET /api/invoices?clientId=&status=` | Returns summary list. |
| `POST /api/invoices` | Validates payload, resolves rates, computes totals, inserts invoice + lines. |
| `GET/POST /api/expenses` | Simple expense capture with GST split. |
| `GET /api/reports/bas` | Placeholder; will use `generateBasPeriods` + `computeBasSummary` in Sprint 6. |

All responses are JSON `{ data: ... }` with 4xx/5xx handled via `http-errors`.

## 6. Frontend State
- **Settings page:** RHF form bound to `/api/settings`, plus GST codes manager.
- **Clients/Employees:** List + create forms with live queries; client screen includes `ClientRatesCard` (pulls employees & client rates, enforces overlap message from backend).
- **Invoices:** Form loads clients/employees/GST codes, caches client rates, auto-fills rates per employee/issue date, tracks overrides, and posts to `/api/invoices`. Recent invoices table shows saved drafts.
- **Expenses:** Grid of expenses + capture form storing dollars in UI (converted to cents before API call).
- Shared UI components (`ui/button`, `ui/card`, etc.) mimic shadcn style; Toaster used for save feedback.

## 7. Dev Workflow
```bash
pnpm install              # bootstrap workspaces
pnpm dev                  # run backend + frontend together
pnpm dev:backend|frontend # run individually
pnpm --filter @taxman/backend db:push  # sync Drizzle schema to SQLite
pnpm lint | pnpm format | pnpm test   # quality commands
pnpm --filter @taxman/frontend typecheck
pnpm --filter @taxman/backend typecheck
```

SQLite lives under `app/backend/db/sqlite`; include that path in backups but keep `.db` out of Git (`.gitignore` already handles it).

## 8. Next Steps for Codex
1. **Sprint 6 (BAS Worksheet):**
   - Flesh out `/api/reports/bas` to accept `frequency`, `basis`, `fiscalYearStart`, `fyStartMonth`.
   - Hook `generateBasPeriods` + `computeBasSummary`.
   - Build reports page UI (period picker, summary cards, exception list placeholder).
2. **Sprint 7 (Data I/O, optional):**
   - CSV import/export utilities (clients, employees, invoices, expenses).
   - Backup/restore actions (copy SQLite file, optional compression).
3. **Hardening:** add Vitest coverage for resolver, BAS helpers, and API routes (via supertest); wire PDF/email later if needed.

When starting a new ChatGPT Codex session, share this document’s summary plus any specific sprint target to keep the assistant aligned.***
