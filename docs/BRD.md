# Tax/Accounting Manager — Offline BAS & Invoicing (Final BRD)

## 1) Purpose & Goals
A lightweight **offline** app to:
- Create and email **compliant tax invoices**.
- Record **supplier bills/expenses** with GST codes.
- Prepare **BAS worksheets** (1A/1B; manual W1/W2/PAYGI optional) for **Monthly/Quarterly/Annual** cycles aligned to the **Australian FY (1 Jul–30 Jun)**.
- Export BAS summary and transaction detail for lodgement elsewhere.

**KPIs**
- Raise/send an invoice in < 2 minutes.
- BAS worksheet export in < 10 minutes from entered data.
- Zero missing GST codes at BAS time (no unresolved exceptions).

## 2) Scope
**In scope (MVP)**
- Company setup (ABN, GST basis, BAS frequency, FY).
- Contacts (customers & suppliers).
- Employees with default billable rates.
- Client-specific **rate cards** per employee (effective-dated).
- Invoices (draft → PDF/email), credit notes, receipts (manual).
- Supplier bills/expenses with per-line GST codes & attachment path.
- BAS worksheet (1A/1B computed; W1/W2/PAYGI manual entry).
- Exceptions list (missing GST code, out-of-period, atypical GST%).
- Exports: BAS PDF and CSV/Excel transaction detail.
- Import/export CSV for contacts, invoices, bills; single-file backup.

**Out of scope**
- Bank import/matching; period close/lock; audit trail.
- Year-end tax pack; core P&L/BS/aging reports.
- Direct ATO e-lodgement; bank feeds; payment gateways; payroll.

## 3) Key Screens
Home, Company Setup, GST Codes, Contacts (Client Rates), Employees, Invoices (List/New/View), Bills (List/New/View), BAS Worksheet (Period/Compute/Exceptions/Export), Data I/O, Settings, Help.

## 4) Critical Functional Requirements
### Invoicing & Rate Autofill
- Selecting **Client** loads that client’s **Rates**.
- Invoice line selecting **Employee** auto-fills **Rate** via client-rate effective on *Issue Date*; else **Employee default**; else block save.
- Line-level **GST code** editable; totals ex/GST/inc auto-calc.
- PDF/Email send with “Tax Invoice”, ABN, dates, totals.

### BAS (FY-aligned)
- **Frequency:** Monthly/Quarterly/Annual; **FY:** AU FY (Jul–Jun).
- **Basis:** Cash/Accrual from Company Setup.
- **1A/1B** computed from invoice/bill line GST; **W1/W2/PAYGI** manual.
- **Exceptions** must be empty to export.

## 5) Non-Functional
Offline-first, local SQLite, optional password, invoice save <2s, BAS recompute <5s for 10k lines, autosave drafts, unsaved-change guard.

## 6) Minimal Data Model
Company, GstCode, Contact, Employee, ClientRate, Invoice, InvoiceLine, Receipt(+Alloc), Bill, BillLine, BasRun, Exception.

## 7) Acceptance Criteria (selection)
- **Autofill:** ClientRate (effective) → else Employee default → else block save.
- **FY Periods:** FY 2025–26 → Monthly Jul 2025..Jun 2026; Quarterly Q1 Jul–Sep etc.
- **Exceptions block export:** Missing GST/out-of-period/atypical % prevent export.
