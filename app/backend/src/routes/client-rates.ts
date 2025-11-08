import { randomUUID } from "node:crypto";

import { and, asc, eq } from "drizzle-orm";
import { Router } from "express";

import { db } from "../db/client.js";
import { clientRates, employees } from "../db/schema.js";
import { asyncHandler } from "../utils/async-handler.js";
import { clientRateSchema } from "../utils/zod-schemas.js";

export const clientRatesRouter: Router = Router();

clientRatesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { clientId } = req.query as { clientId?: string };

    const data = await db
      .select({
        id: clientRates.id,
        clientId: clientRates.clientId,
        employeeId: clientRates.employeeId,
        rateCents: clientRates.rateCents,
        unit: clientRates.unit,
        effectiveFrom: clientRates.effectiveFrom,
        effectiveTo: clientRates.effectiveTo,
        employeeName: employees.fullName
      })
      .from(clientRates)
      .leftJoin(employees, eq(clientRates.employeeId, employees.id))
      .orderBy(asc(clientRates.effectiveFrom));

    const filtered = clientId ? data.filter((rate) => rate.clientId === clientId) : data;

    res.json({ data: filtered });
  })
);

clientRatesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = clientRateSchema.parse(req.body);

    const effectiveFrom = toISODate(payload.effectiveFrom);
    const effectiveTo = payload.effectiveTo ? toISODate(payload.effectiveTo) : null;

    const existingRates = await db
      .select()
      .from(clientRates)
      .where(
        and(eq(clientRates.clientId, payload.clientId), eq(clientRates.employeeId, payload.employeeId))
      );

    const incomingRange = normalizeRange(effectiveFrom, effectiveTo);

    const hasOverlap = existingRates.some((rate) => {
      const range = normalizeRange(rate.effectiveFrom, rate.effectiveTo ?? undefined);
      return rangesOverlap(incomingRange, range);
    });

    if (hasOverlap) {
      return res.status(409).json({ message: "Overlapping rate for this employee" });
    }

    const record = {
      id: randomUUID(),
      clientId: payload.clientId,
      employeeId: payload.employeeId,
      rateCents: payload.rateCents,
      unit: payload.unit,
      effectiveFrom,
      effectiveTo
    };

    await db.insert(clientRates).values(record);
    res.status(201).json({ data: record });
  })
);

function normalizeRange(start: string, end?: string | null) {
  return {
    start: new Date(start).getTime(),
    end: end ? new Date(end).getTime() : Number.POSITIVE_INFINITY
  };
}

function rangesOverlap(a: { start: number; end: number }, b: { start: number; end: number }) {
  return a.start <= b.end && b.start <= a.end;
}

function toISODate(value: Date) {
  return value.toISOString().slice(0, 10);
}
