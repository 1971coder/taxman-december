# ROADMAP — Build Order (Codegen-friendly)

Follow these in order; each step is Codex-friendly and testable.

## Sprint 1 — Settings & FY/BAS
- Schema: company_settings, gst_codes
- API: `GET/PUT /api/settings`, `GET/POST /api/gst-codes`
- UI: Settings form (ABN, basis, frequency, FY)
- Tests: zod for settings; FY helper

## Sprint 2 — Masters
- Schema: contacts (customer/supplier), employees
- API: `GET/POST /api/clients`, `GET/POST /api/employees`
- UI: Contacts + Employees pages

## Sprint 3 — Client Rates
- Schema: client_rates (effective_from/to, no overlaps)
- API: `GET/POST /api/client-rates?clientId=`
- UI: Client → Rates tab with overlap guard
- Tests: effective-dating resolver

## Sprint 4 — Invoicing (Autofill)
- Schema: invoices, invoice_items, receipts (+allocations)
- Helper: `resolveRate(clientId, employeeId, issueDate)`
- API: `POST /api/invoices` (compute totals; block if no rate)
- UI: New Invoice form (client → cache rates; employee → autofill)

## Sprint 5 — Bills & Expenses
- Schema: expenses (amount_ex, gst_cents, category, attachment_path)
- API/UI: CRUD + simple list

## Sprint 6 — BAS Worksheet
- Helpers: `generateFY(fyStart)`; `computeBAS({basis, period}, data)`
- API: `GET /api/reports/bas?...`
- UI: Frequency + FY → Period; Exceptions; Export CSV

## Sprint 7 — Data I/O (optional for MVP)
- CSV import/export for masters & transactions
- Backup/restore (copy SQLite file)
