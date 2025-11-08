import { and, gte, lte, sql } from "drizzle-orm";

import type { DatabaseClient } from "../../db/client.js";
import { db } from "../../db/client.js";
import { expenses, invoices } from "../../db/schema.js";
import type { BasPeriod } from "./periods.js";

export interface BasSummaryInput {
  period: BasPeriod;
  basis: "cash" | "accrual";
  database?: DatabaseClient;
}

export interface BasSummary {
  basis: "cash" | "accrual";
  periodStart: string;
  periodEnd: string;
  salesExCents: number;
  salesGstCents: number;
  purchasesExCents: number;
  purchasesGstCents: number;
  netGstCents: number;
}

export async function computeBasSummary({ period, basis, database = db }: BasSummaryInput): Promise<BasSummary> {
  const periodStart = period.start.toISOString().slice(0, 10);
  const periodEnd = period.end.toISOString().slice(0, 10);

  const [sales] = await database
    .select({
      totalEx: sql<number>`COALESCE(SUM(${invoices.totalExCents}), 0)`,
      totalGst: sql<number>`COALESCE(SUM(${invoices.totalGstCents}), 0)`
    })
    .from(invoices)
    .where(and(gte(invoices.issueDate, periodStart), lte(invoices.issueDate, periodEnd)));

  const [purchases] = await database
    .select({
      totalEx: sql<number>`COALESCE(SUM(${expenses.amountExCents}), 0)`,
      totalGst: sql<number>`COALESCE(SUM(${expenses.gstCents}), 0)`
    })
    .from(expenses)
    .where(and(gte(expenses.incurredDate, periodStart), lte(expenses.incurredDate, periodEnd)));

  const salesExCents = Number(sales?.totalEx ?? 0);
  const salesGstCents = Number(sales?.totalGst ?? 0);
  const purchasesExCents = Number(purchases?.totalEx ?? 0);
  const purchasesGstCents = Number(purchases?.totalGst ?? 0);

  return {
    basis,
    periodStart,
    periodEnd,
    salesExCents,
    salesGstCents,
    purchasesExCents,
    purchasesGstCents,
    netGstCents: salesGstCents - purchasesGstCents
  };
}
