# EPICS & STORIES (Markdown Only)

## EPIC: Company Setup & FY/BAS
- **Story:** Company profile & ABN validation  
  - AC: ABN format validated; defaults saved.
- **Story:** GST basis & BAS frequency settings  
  - AC: Cash/Accrual; Monthly/Quarterly/Annual; persistent.
- **Story:** FY picker (AU: Jul–Jun)  
  - AC: Months/quarters generated correctly.

## EPIC: GST Codes
- **Story:** Maintain GST codes  
  - AC: Create/Edit; cannot delete if in use; deactivate allowed.
- **Story:** Validate atypical %  
  - AC: Exceptions warn on non 0/10% unless explicitly allowed.

## EPIC: Contacts & Client Rates
- **Story:** Contacts CRUD (customers/suppliers)  
  - AC: Searchable; CSV export.
- **Story:** Client Rate Cards (Employee ↔ Rate)  
  - AC: No overlapping effective ranges; help text explains resolution.

## EPIC: Employees (Team)
- **Story:** CRUD with default rates  
  - AC: Default unit+rate used when client-rate missing.

## EPIC: Invoicing
- **Story:** Create invoice (client required)  
  - AC: Issue/Due dates; number auto-increments.
- **Story:** Lines with Employee & rate autofill  
  - AC: ClientRate (effective) → else Employee default → else block save.
- **Story:** PDF/Email (stub ok)  
  - AC: “Tax Invoice”, ABN, dates, totals.
- **Story:** Receipts (manual)  
  - AC: Status changes to Part-paid/Paid.

## EPIC: Bills & Expenses
- **Story:** Enter expenses  
  - AC: GST cents stored; optional attachment path.

## EPIC: BAS Worksheet
- **Story:** Period picker aligned to FY  
  - AC: Monthly/Quarterly/Annual.
- **Story:** Compute 1A/1B by basis  
  - AC: Cash vs Accrual rules applied.
- **Story:** Exceptions + Export gating  
  - AC: Export disabled until exceptions cleared.
