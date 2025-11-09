import { sql } from "drizzle-orm";
import {
  integer,
  real,
  sqliteTable,
  text
} from "drizzle-orm/sqlite-core";

export const companySettings = sqliteTable("company_settings", {
  id: text("id").primaryKey(),
  legalName: text("legal_name").notNull(),
  abn: text("abn", { length: 11 }).notNull(),
  gstBasis: text("gst_basis").notNull(),
  basFrequency: text("bas_frequency").notNull(),
  fyStartMonth: integer("fy_start_month").notNull().default(7),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s','now'))`)
});

export const gstCodes = sqliteTable("gst_codes", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  description: text("description"),
  ratePercent: real("rate_percent").notNull().default(10),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true)
});

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  contactEmail: text("contact_email"),
  defaultRateCents: integer("default_rate_cents"),
  paymentTermsDays: integer("payment_terms_days").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s','now'))`)
});

export const employees = sqliteTable("employees", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  baseRateCents: integer("base_rate_cents").notNull().default(0),
  defaultUnit: text("default_unit").notNull().default("hour"),
  superContributionPercent: real("super_contribution_percent").notNull().default(11),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s','now'))`)
});

export const clientRates = sqliteTable("client_rates", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id),
  employeeId: text("employee_id")
    .notNull()
    .references(() => employees.id),
  rateCents: integer("rate_cents").notNull(),
  unit: text("unit").notNull().default("hour"),
  effectiveFrom: text("effective_from").notNull(),
  effectiveTo: text("effective_to"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s','now'))`)
});

export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey(),
  invoiceNumber: integer("invoice_number").notNull().unique(),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id),
  issueDate: text("issue_date").notNull(),
  dueDate: text("due_date").notNull(),
  cashReceivedDate: text("cash_received_date"),
  status: text("status").notNull().default("draft"),
  reference: text("reference"),
  totalExCents: integer("total_ex_cents").notNull().default(0),
  totalGstCents: integer("total_gst_cents").notNull().default(0),
  totalIncCents: integer("total_inc_cents").notNull().default(0),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s','now'))`)
});

export const invoiceItems = sqliteTable("invoice_items", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id),
  employeeId: text("employee_id")
    .notNull()
    .references(() => employees.id),
  description: text("description").notNull(),
  quantity: real("quantity").notNull().default(0),
  unit: text("unit").notNull().default("hour"),
  rateCents: integer("rate_cents").notNull().default(0),
  amountExCents: integer("amount_ex_cents").notNull().default(0),
  gstCodeId: text("gst_code_id")
    .references(() => gstCodes.id)
    .notNull()
});

export const receipts = sqliteTable("receipts", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id")
    .references(() => invoices.id)
    .notNull(),
  receivedDate: text("received_date").notNull(),
  amountCents: integer("amount_cents").notNull(),
  notes: text("notes")
});

export const receiptAllocations = sqliteTable("receipt_allocations", {
  id: text("id").primaryKey(),
  receiptId: text("receipt_id")
    .notNull()
    .references(() => receipts.id),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id),
  amountCents: integer("amount_cents").notNull()
});

export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(),
  supplierName: text("supplier_name").notNull(),
  category: text("category"),
  amountExCents: integer("amount_ex_cents").notNull().default(0),
  gstCents: integer("gst_cents").notNull().default(0),
  gstCodeId: text("gst_code_id").references(() => gstCodes.id),
  incurredDate: text("incurred_date").notNull(),
  attachmentPath: text("attachment_path"),
  notes: text("notes")
});

export const taxPeriods = sqliteTable("tax_periods", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  frequency: text("frequency").notNull(),
  fy: text("fy").notNull(),
  status: text("status").notNull().default("open")
});

export const basRuns = sqliteTable("bas_runs", {
  id: text("id").primaryKey(),
  taxPeriodId: text("tax_period_id")
    .notNull()
    .references(() => taxPeriods.id),
  basis: text("basis").notNull(),
  payload: text("payload"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s','now'))`)
});

export const exceptions = sqliteTable("exceptions", {
  id: text("id").primaryKey(),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id").notNull(),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  resolvedAt: text("resolved_at")
});
