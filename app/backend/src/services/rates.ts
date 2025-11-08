import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";

import { db as defaultDb } from "../db/client.js";
import type { DatabaseClient } from "../db/client.js";
import { clientRates, employees } from "../db/schema.js";

export interface ResolveRateInput {
  clientId: string;
  employeeId: string;
  issueDate: Date;
}

export async function resolveRate(
  input: ResolveRateInput,
  database: DatabaseClient = defaultDb
): Promise<number | null> {
  const isoDate = input.issueDate.toISOString().slice(0, 10);

  const [matchedRate] = await database
    .select({ rateCents: clientRates.rateCents })
    .from(clientRates)
    .where(
      and(
        eq(clientRates.clientId, input.clientId),
        eq(clientRates.employeeId, input.employeeId),
        lte(clientRates.effectiveFrom, isoDate),
        or(isNull(clientRates.effectiveTo), gte(clientRates.effectiveTo, isoDate))
      )
    )
    .orderBy(desc(clientRates.effectiveFrom))
    .limit(1);

  if (matchedRate) {
    return matchedRate.rateCents;
  }

  const [employee] = await database
    .select({ baseRateCents: employees.baseRateCents })
    .from(employees)
    .where(eq(employees.id, input.employeeId))
    .limit(1);

  return employee?.baseRateCents ?? null;
}
