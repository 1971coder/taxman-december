import type { Express } from "express";
import Database from "better-sqlite3";
import request from "supertest";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";

import { resetDatabase, setupTestApp, withDatabase } from "./test-utils.js";

let app: Express;
let dbPath: string;
let invoiceSequence = 1;

describe("GET /api/reports/bas", () => {
  beforeAll(async () => {
    ({ app, dbPath } = await setupTestApp());
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-08-01T00:00:00.000Z"));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    resetDatabase(dbPath);
    invoiceSequence = 1;
  });

  it("computes BAS summaries using company defaults", async () => {
    seedCompanySettings();
    const clientId = seedClient({ id: "client-1", displayName: "Acme Pty" });
    seedInvoice({
      id: "inv-1",
      clientId,
      issueDate: "2024-07-10",
      totalExCents: 120_000,
      totalGstCents: 12_000,
      totalIncCents: 132_000,
      cashReceivedDate: "2024-07-15",
      invoiceNumber: 1
    });
    seedExpense({
      id: "exp-1",
      supplierName: "Office Supplies",
      amountExCents: 40_000,
      gstCents: 4_000,
      incurredDate: "2024-07-12"
    });

    const response = await request(app).get("/api/reports/bas").expect(200);

    const { data } = response.body;
    expect(data.request.frequency).toBe("quarterly");
    expect(data.request.basis).toBe("cash");
    expect(data.request.fiscalYearStart).toBe(2024);
    expect(data.fiscalYearLabel).toBe("FY 2024-25");
    expect(data.periods).toHaveLength(4);

    const firstPeriod = data.periods[0];
    expect(firstPeriod.period.label).toBe("Q1 FY 2024-25");
    expect(firstPeriod.summary.salesExCents).toBe(120_000);
    expect(firstPeriod.summary.salesGstCents).toBe(12_000);
    expect(firstPeriod.summary.purchasesExCents).toBe(40_000);
    expect(firstPeriod.summary.purchasesGstCents).toBe(4_000);
    expect(firstPeriod.summary.netGstCents).toBe(8_000);
  });

  it("honors query overrides for frequency, basis, and FY start", async () => {
    seedCompanySettings({ basFrequency: "annual", gstBasis: "cash" });
    const clientId = seedClient({ id: "client-override", displayName: "Override Client" });
    seedInvoice({
      id: "inv-override",
      clientId,
      issueDate: "2025-07-04",
      totalExCents: 75_000,
      totalGstCents: 7_500,
      totalIncCents: 82_500,
      cashReceivedDate: "2025-07-06",
      invoiceNumber: 99
    });

    const response = await request(app)
      .get("/api/reports/bas")
      .query({
        frequency: "monthly",
        basis: "accrual",
        fiscalYearStart: 2025,
        fyStartMonth: 7
      })
      .expect(200);

    const { data } = response.body;
    expect(data.request.frequency).toBe("monthly");
    expect(data.request.basis).toBe("accrual");
    expect(data.request.fiscalYearStart).toBe(2025);
    expect(data.fiscalYearLabel).toBe("FY 2025-26");
    expect(data.periods).toHaveLength(12);
    expect(data.periods[0].period.label).toBe("Jul FY 2025-26");
    expect(data.periods[0].summary.salesExCents).toBe(75_000);
  });

  it("only includes invoices with cash received dates inside the period for cash basis", async () => {
    seedCompanySettings({ gstBasis: "cash", basFrequency: "quarterly" });
    const clientId = seedClient({ id: "client-cash", displayName: "Cash Client" });

    seedInvoice({
      id: "inv-cash-1",
      clientId,
      issueDate: "2024-07-05",
      totalExCents: 40_000,
      totalGstCents: 4_000,
      totalIncCents: 44_000,
      invoiceNumber: 101
    });

    seedInvoice({
      id: "inv-cash-2",
      clientId,
      issueDate: "2024-07-15",
      totalExCents: 60_000,
      totalGstCents: 6_000,
      totalIncCents: 66_000,
      cashReceivedDate: "2024-10-01", // outside Q1
      invoiceNumber: 102
    });

    seedInvoice({
      id: "inv-cash-3",
      clientId,
      issueDate: "2024-08-01",
      totalExCents: 80_000,
      totalGstCents: 8_000,
      totalIncCents: 88_000,
      cashReceivedDate: "2024-08-15",
      invoiceNumber: 103
    });

    const response = await request(app).get("/api/reports/bas").expect(200);
    const { data } = response.body;
    const firstPeriod = data.periods[0];

    expect(firstPeriod.summary.salesExCents).toBe(80_000);
    expect(firstPeriod.summary.salesGstCents).toBe(8_000);
  });
});

function seedCompanySettings(overrides: Partial<{ basFrequency: string; gstBasis: string; fyStartMonth: number }> = {}) {
  withDatabase(dbPath, (sqlite) => {
    sqlite
      .prepare(
        `
        INSERT INTO company_settings (id, legal_name, abn, gst_basis, bas_frequency, fy_start_month)
        VALUES (@id, @legalName, @abn, @gstBasis, @basFrequency, @fyStartMonth)
      `
      )
      .run({
        id: "company-settings",
        legalName: "Main Co",
        abn: "12345678901",
        gstBasis: overrides.gstBasis ?? "cash",
        basFrequency: overrides.basFrequency ?? "quarterly",
        fyStartMonth: overrides.fyStartMonth ?? 7
      });
  });
}

function seedClient(overrides: { id: string; displayName: string }) {
  withDatabase(dbPath, (sqlite) => {
    sqlite
      .prepare(
        `
        INSERT INTO clients (id, display_name, contact_email, default_rate_cents, is_active)
        VALUES (@id, @displayName, @contactEmail, @defaultRateCents, @isActive)
      `
      )
      .run({
        id: overrides.id,
        displayName: overrides.displayName,
        contactEmail: "contact@example.com",
        defaultRateCents: 10_000,
        isActive: 1
      });
  });
  return overrides.id;
}

function seedInvoice({
  id,
  clientId,
  issueDate,
  totalExCents,
  totalGstCents,
  totalIncCents,
  cashReceivedDate,
  invoiceNumber
}: {
  id: string;
  clientId: string;
  issueDate: string;
  totalExCents: number;
  totalGstCents: number;
  totalIncCents: number;
  cashReceivedDate?: string | null;
  invoiceNumber?: number;
}) {
  withDatabase(dbPath, (sqlite) => {
    sqlite
      .prepare(
        `
        INSERT INTO invoices (id, invoice_number, client_id, issue_date, due_date, cash_received_date, status, total_ex_cents, total_gst_cents, total_inc_cents)
        VALUES (@id, @invoiceNumber, @clientId, @issueDate, @dueDate, @cashReceivedDate, @status, @totalExCents, @totalGstCents, @totalIncCents)
      `
      )
      .run({
        id,
        invoiceNumber: invoiceNumber ?? invoiceSequence++,
        clientId,
        issueDate,
        dueDate: issueDate,
        cashReceivedDate: cashReceivedDate ?? null,
        status: "submitted",
        totalExCents,
        totalGstCents,
        totalIncCents
      });
  });
}

function seedExpense({
  id,
  supplierName,
  amountExCents,
  gstCents,
  incurredDate
}: {
  id: string;
  supplierName: string;
  amountExCents: number;
  gstCents: number;
  incurredDate: string;
}) {
  withDatabase(dbPath, (sqlite) => {
    sqlite
      .prepare(
        `
        INSERT INTO expenses (id, supplier_name, category, amount_ex_cents, gst_cents, incurred_date)
        VALUES (@id, @supplierName, 'General', @amountExCents, @gstCents, @incurredDate)
      `
      )
      .run({
        id,
        supplierName,
        amountExCents,
        gstCents,
        incurredDate
      });
  });
}
