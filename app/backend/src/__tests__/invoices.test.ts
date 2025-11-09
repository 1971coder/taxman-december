import type { Express } from "express";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { resetDatabase, setupTestApp, withDatabase } from "./test-utils.js";

let app: Express;
let dbPath: string;

const CLIENT_ID = "11111111-1111-4111-8111-111111111119";
const EMPLOYEE_ID = "22222222-2222-4222-8222-222222222229";
const GST_CODE_ID = "00000000-0000-4000-8000-000000000001";

describe("POST /api/invoices", () => {
  beforeAll(async () => {
    ({ app, dbPath } = await setupTestApp());
  });

  beforeEach(() => {
    resetDatabase(dbPath);
    seedClient();
    seedEmployee();
    seedGstCode();
  });

  it("assigns sequential invoice numbers and stores cash received dates", async () => {
    const basePayload = {
      clientId: CLIENT_ID,
      issueDate: "2024-07-01",
      dueDate: "2024-07-08",
      cashReceivedDate: "2024-07-09",
      lines: [
        {
          employeeId: EMPLOYEE_ID,
          description: "Consulting",
          quantity: 1,
          unit: "hour",
          rate: 0,
          gstCodeId: GST_CODE_ID,
          overrideRate: false
        }
      ]
    };

    const firstResponse = await request(app).post("/api/invoices").send(basePayload).expect(201);

    expect(firstResponse.body.data.invoiceNumber).toBe(1);
    expect(firstResponse.body.data.cashReceivedDate).toBe("2024-07-09");

    const secondResponse = await request(app)
      .post("/api/invoices")
      .send({
        ...basePayload,
        issueDate: "2024-07-15",
        dueDate: "2024-07-22",
        cashReceivedDate: "2024-07-25"
      })
      .expect(201);

    expect(secondResponse.body.data.invoiceNumber).toBe(2);

    const storedInvoices = withDatabase(dbPath, (sqlite) =>
      sqlite.prepare("SELECT invoice_number AS invoiceNumber, cash_received_date AS cashReceivedDate FROM invoices ORDER BY invoice_number").all()
    );

    expect(storedInvoices).toEqual([
      { invoiceNumber: 1, cashReceivedDate: "2024-07-09" },
      { invoiceNumber: 2, cashReceivedDate: "2024-07-25" }
    ]);
  });
});

function seedClient() {
  withDatabase(dbPath, (sqlite) => {
    sqlite
      .prepare(
        `
        INSERT INTO clients (id, display_name, contact_email, address, default_rate_cents, is_active)
        VALUES (@id, 'Client A', 'client@example.com', '123 Example St', 0, 1)
      `
      )
      .run({ id: CLIENT_ID });
  });
}

function seedEmployee() {
  withDatabase(dbPath, (sqlite) => {
    sqlite
      .prepare(
        `
        INSERT INTO employees (id, full_name, email, base_rate_cents, default_unit, is_active)
        VALUES (@id, 'Employee A', 'emp@example.com', 10000, 'hour', 1)
      `
      )
      .run({ id: EMPLOYEE_ID });
  });
}

function seedGstCode() {
  withDatabase(dbPath, (sqlite) => {
    sqlite
      .prepare(
        `
        INSERT INTO gst_codes (id, code, description, rate_percent, is_active)
        VALUES (@id, 'GST', 'Standard GST', 10, 1)
      `
      )
      .run({ id: GST_CODE_ID });
  });
}
