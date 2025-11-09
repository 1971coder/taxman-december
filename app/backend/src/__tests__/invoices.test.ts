import type { Express } from "express";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { resetDatabase, setupTestApp, withDatabase } from "./test-utils.js";

let app: Express;
let dbPath: string;

const CLIENT_ID = "11111111-1111-4111-8111-111111111119";
const EMPLOYEE_ID = "22222222-2222-4222-8222-222222222229";
const GST_CODE_ID = "00000000-0000-4000-8000-000000000001";

describe("Invoices API", () => {
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

  it("defaults the due date using client payment terms", async () => {
    const response = await request(app)
      .post("/api/invoices")
      .send({
        clientId: CLIENT_ID,
        issueDate: "2024-08-01",
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
      })
      .expect(201);

    expect(response.body.data.dueDate).toBe("2024-08-15");

    const storedInvoice = withDatabase(dbPath, (sqlite) =>
      sqlite
        .prepare("SELECT due_date AS dueDate FROM invoices WHERE id = @id")
        .get({ id: response.body.data.id })
    );

    expect(storedInvoice?.dueDate).toBe("2024-08-15");
  });

  it("returns invoice details with line items", async () => {
    const payload = buildInvoicePayload({
      cashReceivedDate: "2024-07-20",
      reference: "INV-0001",
      notes: "Thanks!",
      lines: [
        {
          employeeId: EMPLOYEE_ID,
          description: "Consulting block",
          quantity: 2,
          unit: "day",
          rate: 150,
          gstCodeId: GST_CODE_ID,
          overrideRate: true
        }
      ]
    });

    const createResponse = await request(app).post("/api/invoices").send(payload).expect(201);
    const invoiceId = createResponse.body.data.id;

    const detailResponse = await request(app).get(`/api/invoices/${invoiceId}`).expect(200);

    expect(detailResponse.body.data.reference).toBe("INV-0001");
    expect(detailResponse.body.data.lines).toHaveLength(1);
    expect(detailResponse.body.data.lines[0]).toMatchObject({
      employeeId: EMPLOYEE_ID,
      description: "Consulting block",
      quantity: 2,
      unit: "day",
      rate: 150,
      overrideRate: true
    });
  });

  it("updates invoices and replaces existing line items", async () => {
    const createResponse = await request(app)
      .post("/api/invoices")
      .send(
        buildInvoicePayload({
          cashReceivedDate: "2024-07-05",
          lines: [
            {
              employeeId: EMPLOYEE_ID,
              description: "Initial",
              quantity: 1,
              unit: "hour",
              rate: 120,
              gstCodeId: GST_CODE_ID,
              overrideRate: true
            }
          ]
        })
      )
      .expect(201);

    const invoiceId = createResponse.body.data.id;

    const updateResponse = await request(app)
      .put(`/api/invoices/${invoiceId}`)
      .send(
        buildInvoicePayload({
          issueDate: "2024-08-01",
          dueDate: "2024-08-10",
          cashReceivedDate: "2024-08-12",
          reference: "INV-EDIT",
          notes: "Edited invoice",
          lines: [
            {
              employeeId: EMPLOYEE_ID,
              description: "Updated description",
              quantity: 2,
              unit: "day",
              rate: 300,
              gstCodeId: GST_CODE_ID,
              overrideRate: true
            }
          ]
        })
      )
      .expect(200);

    expect(updateResponse.body.data.issueDate).toBe("2024-08-01");
    expect(updateResponse.body.data.cashReceivedDate).toBe("2024-08-12");
    expect(updateResponse.body.data.reference).toBe("INV-EDIT");
    expect(updateResponse.body.data.totalIncCents).toBe(66000);

    const persisted = withDatabase(dbPath, (sqlite) => ({
      invoice: sqlite
        .prepare("SELECT issue_date AS issueDate, total_inc_cents AS totalIncCents FROM invoices WHERE id = @id")
        .get({ id: invoiceId }),
      lineCount: sqlite.prepare("SELECT COUNT(*) AS count FROM invoice_items WHERE invoice_id = @id").get({ id: invoiceId })
    }));

    expect(persisted.invoice.totalIncCents).toBe(66000);
    expect(persisted.lineCount.count).toBe(1);
  });

  it("deletes invoices and cascades to line items", async () => {
    const createResponse = await request(app)
      .post("/api/invoices")
      .send(
        buildInvoicePayload({
          lines: [
            {
              employeeId: EMPLOYEE_ID,
              description: "To delete",
              quantity: 1,
              unit: "hour",
              rate: 110,
              gstCodeId: GST_CODE_ID,
              overrideRate: true
            }
          ]
        })
      )
      .expect(201);

    const invoiceId = createResponse.body.data.id;

    await request(app).delete(`/api/invoices/${invoiceId}`).expect(204);

    const counts = withDatabase(dbPath, (sqlite) => ({
      invoices: sqlite.prepare("SELECT COUNT(*) AS count FROM invoices").get(),
      items: sqlite.prepare("SELECT COUNT(*) AS count FROM invoice_items").get()
    }));

    expect(counts.invoices.count).toBe(0);
    expect(counts.items.count).toBe(0);
  });
});

function buildInvoicePayload({
  clientId = CLIENT_ID,
  issueDate = "2024-07-01",
  dueDate = "2024-07-08",
  cashReceivedDate,
  reference,
  notes,
  lines
}: {
  clientId?: string;
  issueDate?: string;
  dueDate?: string;
  cashReceivedDate?: string;
  reference?: string;
  notes?: string;
  lines: Array<{
    employeeId: string;
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    gstCodeId: string;
    overrideRate: boolean;
  }>;
}) {
  return {
    clientId,
    issueDate,
    dueDate,
    cashReceivedDate,
    reference,
    notes,
    lines
  };
}

function seedClient() {
  withDatabase(dbPath, (sqlite) => {
    sqlite
      .prepare(
        `
        INSERT INTO clients (id, display_name, contact_email, default_rate_cents, payment_terms_days, is_active)
        VALUES (@id, 'Client A', 'client@example.com', 0, 14, 1)
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
        INSERT INTO employees (id, full_name, email, base_rate_cents, default_unit, super_contribution_percent, is_active)
        VALUES (@id, 'Employee A', 'emp@example.com', 10000, 'hour', 11, 1)
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
