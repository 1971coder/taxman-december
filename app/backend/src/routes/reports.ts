import { Router } from "express";

import { db } from "../db/client.js";
import { companySettings } from "../db/schema.js";
import { computeBasSummary } from "../services/bas/compute.js";
import {
  alignDateToFinancialYear,
  DEFAULT_FY_START_MONTH,
  formatFinancialYearLabel,
  generateBasPeriods
} from "../services/bas/periods.js";
import { asyncHandler } from "../utils/async-handler.js";
import { basRequestSchema, type BasReportResponse } from "../utils/zod-schemas.js";

export const reportsRouter: Router = Router();

const basQuerySchema = basRequestSchema.partial();

reportsRouter.get(
  "/bas",
  asyncHandler(async (req, res) => {
    const [settings] = await db.select().from(companySettings).limit(1);
    const overrides = basQuerySchema.parse({
      frequency: getQueryValue(req.query.frequency),
      basis: getQueryValue(req.query.basis),
      fiscalYearStart: toNumber(getQueryValue(req.query.fiscalYearStart)),
      fyStartMonth: toNumber(getQueryValue(req.query.fyStartMonth))
    });

    const fyStartMonth = overrides.fyStartMonth ?? settings?.fyStartMonth ?? DEFAULT_FY_START_MONTH;
    const fiscalYearStart =
      overrides.fiscalYearStart ??
      deriveFinancialYearStart({ fyStartMonth });
    const frequency = overrides.frequency ?? (settings?.basFrequency as BasReportResponse["request"]["frequency"]) ?? "quarterly";
    const basis = overrides.basis ?? (settings?.gstBasis as BasReportResponse["request"]["basis"]) ?? "cash";

    const periods = generateBasPeriods({
      fiscalYearStart,
      frequency,
      fyStartMonth
    });

    const summaries = await Promise.all(
      periods.map((period) => computeBasSummary({ period, basis }))
    );

    const payload: BasReportResponse = {
      request: {
        frequency,
        basis,
        fiscalYearStart,
        fyStartMonth
      },
      fiscalYearLabel: formatFinancialYearLabel(fiscalYearStart),
      periods: periods.map((period, index) => ({
        period: {
          ...period,
          start: period.start.toISOString().slice(0, 10),
          end: period.end.toISOString().slice(0, 10)
        },
        summary: summaries[index]
      })),
      exceptions: []
    };

    res.json({ data: payload });
  })
);

function getQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
}

function toNumber(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function deriveFinancialYearStart({ fyStartMonth }: { fyStartMonth: number }): number {
  const today = new Date();
  const { startYear } = alignDateToFinancialYear(today, fyStartMonth);
  return startYear;
}
