import type { Express } from "express";
import Database from "better-sqlite3";
import request from "supertest";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";

import { resetDatabase, setupTestApp, withDatabase } from "./test-utils.js";

let app: Express;
let dbPath: string;

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
      totalIncCents: 132_000
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
      totalIncCents: 82_500
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
  totalIncCents
}: {
  id: string;
  clientId: string;
  issueDate: string;
  totalExCents: number;
  totalGstCents: number;
  totalIncCents: number;
}) {
  withDatabase(dbPath, (sqlite) => {
    sqlite
      .prepare(
        `
        INSERT INTO invoices (id, client_id, issue_date, due_date, status, total_ex_cents, total_gst_cents, total_inc_cents)
        VALUES (@id, @clientId, @issueDate, @dueDate, @status, @totalExCents, @totalGstCents, @totalIncCents)
      `
      )
      .run({
        id,
        clientId,
        issueDate,
        dueDate: issueDate,
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
