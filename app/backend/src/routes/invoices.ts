import { randomUUID } from "node:crypto";

import { desc, eq, inArray, sql } from "drizzle-orm";
import { Router } from "express";
import createHttpError from "http-errors";

import { db } from "../db/client.js";
import { clients, gstCodes, invoiceItems, invoices } from "../db/schema.js";
import { asyncHandler } from "../utils/async-handler.js";
import { invoiceSchema } from "../utils/zod-schemas.js";
import { resolveRate } from "../services/rates.js";

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

invoicesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = invoiceSchema.parse(req.body);

    if (payload.lines.length === 0) {
      throw createHttpError(400, "Invoice needs at least one line");
    }

    const issueDate = payload.issueDate;
    const dueDate = payload.dueDate ?? payload.issueDate;
    const cashReceivedDate = payload.cashReceivedDate;
    const isoCashReceivedDate = cashReceivedDate ? cashReceivedDate.toISOString().slice(0, 10) : null;

    const gstCodeIds = Array.from(new Set(payload.lines.map((line) => line.gstCodeId)));

    const gstCodeRecords = await db
      .select({ id: gstCodes.id, ratePercent: gstCodes.ratePercent })
      .from(gstCodes)
      .where(inArray(gstCodes.id, gstCodeIds));

    const gstLookup = new Map(gstCodeRecords.map((code) => [code.id, code.ratePercent]));

    for (const id of gstCodeIds) {
      if (!gstLookup.has(id)) {
        throw createHttpError(400, `GST code ${id} not found`);
      }
    }

    const invoiceId = randomUUID();
    const isoIssueDate = issueDate.toISOString().slice(0, 10);
    const isoDueDate = dueDate.toISOString().slice(0, 10);

    const result = await db.transaction(async (tx) => {
      let totalExCents = 0;
      let totalGstCents = 0;

      const lineRecords = [] as (typeof invoiceItems.$inferInsert)[];

      const [maxNumberRow] = await tx
        .select({ maxNumber: sql<number>`COALESCE(MAX(${invoices.invoiceNumber}), 0)` })
        .from(invoices);
      const invoiceNumber = Number(maxNumberRow?.maxNumber ?? 0) + 1;

      for (const [index, line] of payload.lines.entries()) {
        const rateCents = await determineLineRate({
          clientId: payload.clientId,
          employeeId: line.employeeId,
          issueDate,
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
