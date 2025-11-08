import { randomUUID } from "node:crypto";

import { desc } from "drizzle-orm";
import { Router } from "express";

import { db } from "../db/client.js";
import { expenses } from "../db/schema.js";
import { asyncHandler } from "../utils/async-handler.js";
import { expenseSchema } from "../utils/zod-schemas.js";

export const expensesRouter: Router = Router();

expensesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const data = await db.select().from(expenses).orderBy(desc(expenses.incurredDate));
    res.json({ data });
  })
);

expensesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = expenseSchema.parse(req.body);
    const record = {
      id: randomUUID(),
      supplierName: payload.supplierName,
      category: payload.category,
      amountExCents: payload.amountExCents,
      gstCents: payload.gstCents,
      gstCodeId: payload.gstCodeId ?? null,
      incurredDate: payload.incurredDate.toISOString().slice(0, 10),
      attachmentPath: payload.attachmentPath,
      notes: payload.notes
    };

    await db.insert(expenses).values(record);
    res.status(201).json({ data: record });
  })
);
