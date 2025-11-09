# Minimal, Robust Architecture (Markdown Only)

## Tech Choices (intentionally few)
**Frontend:** React + Vite + TypeScript, Tailwind CSS + shadcn/ui + lucide-react, React Hook Form + Zod, TanStack Query.  
**Backend:** Node.js + Express + TypeScript, better-sqlite3, Zod (validation).  
**DB:** SQLite (single file), Drizzle ORM (schema-as-code + migrations).  
**Build/Quality:** pnpm (or npm), ESLint + Prettier, Vitest.

## High-level Diagram
```
[ React (Vite) ]
   │  TanStack Query (fetch/cache)
   ▼
[ Express API (TS) ]
   │  zod validate
   ▼
[ Drizzle ORM ] ───> [ SQLite file.db ]
```

## Repository Layout (target)
```
app/
  backend/
    src/
      index.ts               # Express bootstrap
      routes/
        clients.ts
        employees.ts
        invoices.ts
        expenses.ts
        reports.ts           # BAS
        settings.ts          # company, FY/BAS
      services/              # thin business logic
      db/
        schema.ts            # Drizzle tables
        drizzle.config.ts
        migrations/          # generated SQL
      utils/
        zod-schemas.ts
    package.json, tsconfig.json
  frontend/
    src/
      main.tsx
      app.tsx                # routes/layout
      lib/
        api.ts
        queryClient.ts
      components/
        ui/*
        forms/*
      pages/
        dashboard/
        clients/
        employees/
        invoices/
        expenses/
        reports/
        settings/
    index.html, tailwind.config.cjs
    package.json, tsconfig.json, vite.config.ts
package.json (workspace), README.md
```

## Data Model (core fields)
- **company_settings**: id, legal_name, abn, gst_basis, bas_frequency, fy_start_month, created_at
- **clients**: id, display_name, contact_email, address, default_rate_cents, is_active
- **employees**: id, full_name, email, base_rate_cents, default_unit, is_active
- **client_rates**: id, client_id, employee_id, rate_cents, unit, effective_from, effective_to
- **invoices / invoice_items**, **receipts / receipt_allocations**
- **expenses**, **tax_periods**, **gst_codes**

## API Surface (clean & tiny)
- `GET/PUT /api/settings`
- `GET/POST/PUT /api/clients`
- `GET/POST /api/employees`
- `GET /api/invoices?status=&clientId=` · `POST /api/invoices` · `PUT /api/invoices/:id`
- `GET/POST /api/expenses`
- `GET /api/reports/bas?period=` (Monthly/Quarterly/Annual; FY-aware)
- Validation everywhere with **Zod**; JSON error format.
