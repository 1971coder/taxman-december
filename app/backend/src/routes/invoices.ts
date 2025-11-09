import { randomUUID } from "node:crypto";

import { desc, eq, inArray, sql } from "drizzle-orm";
import { Router } from "express";
import createHttpError from "http-errors";

import { db } from "../db/client.js";
import type { DatabaseClient } from "../db/client.js";
import { clients, gstCodes, invoiceItems, invoices, receiptAllocations, receipts } from "../db/schema.js";
import { asyncHandler } from "../utils/async-handler.js";
import { invoiceSchema } from "../utils/zod-schemas.js";
import type { InvoiceInput } from "../utils/zod-schemas.js";
import { resolveRate } from "../services/rates.js";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbLike = DatabaseClient | TransactionClient;

export const invoicesRouter: Router = Router();

invoicesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { clientId, status } = req.query as { clientId?: string; status?: string };

    const data = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        clientId: invoices.clientId,
        clientName: clients.displayName,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        status: invoices.status,
        cashReceivedDate: invoices.cashReceivedDate,
        totalIncCents: invoices.totalIncCents
      })
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .orderBy(desc(invoices.issueDate));

    const filtered = data.filter((invoice) => {
      if (clientId && invoice.clientId !== clientId) {
        return false;
      }
      if (status && invoice.status !== status) {
        return false;
      }
      return true;
    });

    res.json({ data: filtered });
  })
);

async function determineLineRate({
  clientId,
  employeeId,
  issueDate,
  overrideRate,
  providedRate
}: {
  clientId: string;
  employeeId: string;
  issueDate: Date;
  overrideRate?: boolean;
  providedRate: number;
}) {
  if (overrideRate && providedRate > 0) {
    return Math.round(providedRate * 100);
  }

  return resolveRate({ clientId, employeeId, issueDate });
}

async function resolveDueDate(
  database: DbLike,
  clientId: string,
  issueDate: Date,
  providedDueDate?: Date
) {
  if (providedDueDate) {
    return providedDueDate;
  }

  const [clientRecord] = await database
    .select({ paymentTermsDays: clients.paymentTermsDays })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  const paymentTermsDays = clientRecord?.paymentTermsDays ?? 0;
  return addDays(issueDate, paymentTermsDays);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

async function buildInvoiceLineRecords({
  database,
  payload,
  invoiceId
}: {
  database: DbLike;
  payload: InvoiceInput;
  invoiceId: string;
}) {
  const gstCodeIds = Array.from(new Set(payload.lines.map((line) => line.gstCodeId)));

  const gstCodeRecords = gstCodeIds.length
    ? await database
        .select({ id: gstCodes.id, ratePercent: gstCodes.ratePercent })
        .from(gstCodes)
        .where(inArray(gstCodes.id, gstCodeIds))
    : [];

  const gstLookup = new Map(gstCodeRecords.map((code) => [code.id, code.ratePercent]));

  for (const id of gstCodeIds) {
    if (!gstLookup.has(id)) {
      throw createHttpError(400, `GST code ${id} not found`);
    }
  }

  let totalExCents = 0;
  let totalGstCents = 0;

  const lineRecords: (typeof invoiceItems.$inferInsert)[] = [];

  for (const [index, line] of payload.lines.entries()) {
    const rateCents = await determineLineRate({
      clientId: payload.clientId,
      employeeId: line.employeeId,
      issueDate: payload.issueDate,
      overrideRate: line.overrideRate,
      providedRate: line.rate
    });

    if (rateCents === null) {
      throw createHttpError(400, `Unable to resolve rate for line ${index + 1}`);
    }

    const amountExCents = Math.round(line.quantity * rateCents);
    const gstRate = gstLookup.get(line.gstCodeId) ?? 0;
    const gstCents = Math.round(amountExCents * (gstRate / 100));

    totalExCents += amountExCents;
    totalGstCents += gstCents;

    lineRecords.push({
      id: randomUUID(),
      invoiceId,
      employeeId: line.employeeId,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      rateCents,
      amountExCents,
      gstCodeId: line.gstCodeId
    });
  }

  return {
    lineRecords,
    totalExCents,
    totalGstCents
  };
}

invoicesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = invoiceSchema.parse(req.body);

    if (payload.lines.length === 0) {
      throw createHttpError(400, "Invoice needs at least one line");
    }

    const issueDate = payload.issueDate;
    const dueDate = await resolveDueDate(db, payload.clientId, issueDate, payload.dueDate);
    const cashReceivedDate = payload.cashReceivedDate;
    const isoCashReceivedDate = cashReceivedDate ? cashReceivedDate.toISOString().slice(0, 10) : null;

    const invoiceId = randomUUID();
    const isoIssueDate = issueDate.toISOString().slice(0, 10);
    const isoDueDate = dueDate.toISOString().slice(0, 10);

    const result = await db.transaction(async (tx) => {
      const [maxNumberRow] = await tx
        .select({ maxNumber: sql<number>`COALESCE(MAX(${invoices.invoiceNumber}), 0)` })
        .from(invoices);
      const invoiceNumber = Number(maxNumberRow?.maxNumber ?? 0) + 1;

      const { lineRecords, totalExCents, totalGstCents } = await buildInvoiceLineRecords({
        database: tx,
        invoiceId,
        payload
      });

      await tx.insert(invoices).values({
        id: invoiceId,
        invoiceNumber,
        clientId: payload.clientId,
        issueDate: isoIssueDate,
        dueDate: isoDueDate,
        cashReceivedDate: isoCashReceivedDate,
        reference: payload.reference,
        notes: payload.notes,
        status: "draft",
        totalExCents,
        totalGstCents,
        totalIncCents: totalExCents + totalGstCents
      });

      await tx.insert(invoiceItems).values(lineRecords);

      return {
        id: invoiceId,
        invoiceNumber,
        clientId: payload.clientId,
        issueDate: isoIssueDate,
        dueDate: isoDueDate,
        cashReceivedDate: isoCashReceivedDate,
        totalExCents,
        totalGstCents,
        totalIncCents: totalExCents + totalGstCents,
        status: "draft"
      };
    });

    res.status(201).json({ data: result });
  })
);

invoicesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const [invoiceRecord] = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        clientId: invoices.clientId,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        cashReceivedDate: invoices.cashReceivedDate,
        reference: invoices.reference,
        notes: invoices.notes,
        status: invoices.status,
        totalExCents: invoices.totalExCents,
        totalGstCents: invoices.totalGstCents,
        totalIncCents: invoices.totalIncCents
      })
      .from(invoices)
      .where(eq(invoices.id, id))
      .limit(1);

    if (!invoiceRecord) {
      throw createHttpError(404, "Invoice not found");
    }

    const lineRows = await db
      .select({
        id: invoiceItems.id,
        employeeId: invoiceItems.employeeId,
        description: invoiceItems.description,
        quantity: invoiceItems.quantity,
        unit: invoiceItems.unit,
        rateCents: invoiceItems.rateCents,
        gstCodeId: invoiceItems.gstCodeId
      })
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, id));

    const lines = lineRows.map((line) => ({
      id: line.id,
      employeeId: line.employeeId,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      rate: line.rateCents / 100,
      gstCodeId: line.gstCodeId,
      overrideRate: true
    }));

    res.json({
      data: {
        ...invoiceRecord,
        lines
      }
    });
  })
);

invoicesRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const payload = invoiceSchema.parse(req.body);

    if (payload.lines.length === 0) {
      throw createHttpError(400, "Invoice needs at least one line");
    }

    const [existingInvoice] = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        status: invoices.status
      })
      .from(invoices)
      .where(eq(invoices.id, id))
      .limit(1);

    if (!existingInvoice) {
      throw createHttpError(404, "Invoice not found");
    }

    const issueDate = payload.issueDate;
    const dueDate = await resolveDueDate(db, payload.clientId, issueDate, payload.dueDate);
    const cashReceivedDate = payload.cashReceivedDate;
    const isoCashReceivedDate = cashReceivedDate ? cashReceivedDate.toISOString().slice(0, 10) : null;
    const isoIssueDate = issueDate.toISOString().slice(0, 10);
    const isoDueDate = dueDate.toISOString().slice(0, 10);

    const result = await db.transaction(async (tx) => {
      const { lineRecords, totalExCents, totalGstCents } = await buildInvoiceLineRecords({
        database: tx,
        invoiceId: id,
        payload
      });

      await tx
        .update(invoices)
        .set({
          clientId: payload.clientId,
          issueDate: isoIssueDate,
          dueDate: isoDueDate,
          cashReceivedDate: isoCashReceivedDate,
          reference: payload.reference,
          notes: payload.notes,
          totalExCents,
          totalGstCents,
          totalIncCents: totalExCents + totalGstCents
        })
        .where(eq(invoices.id, id));

      await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
      await tx.insert(invoiceItems).values(lineRecords);

      return {
        id,
        invoiceNumber: existingInvoice.invoiceNumber,
        clientId: payload.clientId,
        issueDate: isoIssueDate,
        dueDate: isoDueDate,
        cashReceivedDate: isoCashReceivedDate,
        reference: payload.reference,
        notes: payload.notes,
        totalExCents,
        totalGstCents,
        totalIncCents: totalExCents + totalGstCents,
        status: existingInvoice.status
      };
    });

    res.json({ data: result });
  })
);

invoicesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const [existingInvoice] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.id, id))
      .limit(1);

    if (!existingInvoice) {
      throw createHttpError(404, "Invoice not found");
    }

    const [{ count: receiptCount } = { count: 0 }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(receipts)
      .where(eq(receipts.invoiceId, id));

    if ((receiptCount ?? 0) > 0) {
      throw createHttpError(409, "Cannot delete invoice that has receipts");
    }

    const [{ count: allocationCount } = { count: 0 }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(receiptAllocations)
      .where(eq(receiptAllocations.invoiceId, id));

    if ((allocationCount ?? 0) > 0) {
      throw createHttpError(409, "Cannot delete invoice referenced by receipt allocations");
    }

    await db.transaction(async (tx) => {
      await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
      await tx.delete(invoices).where(eq(invoices.id, id));
    });

    res.status(204).send();
  })
);
