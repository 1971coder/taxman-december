export type BasFrequency = "monthly" | "quarterly" | "annual";

export interface BasPeriod {
  label: string;
  index: number;
  start: Date;
  end: Date;
}

export interface GenerateBasPeriodsInput {
  fiscalYearStart: number; // e.g. 2025 => FY 2025-26
  frequency: BasFrequency;
  fyStartMonth?: number; // 1 = Jan ... 12 = Dec
}

const MONTHS_IN_YEAR = 12;
export const DEFAULT_FY_START_MONTH = 7; // July

export function alignDateToFinancialYear(
  date: Date,
  fyStartMonth: number = DEFAULT_FY_START_MONTH
): {
  startYear: number;
  endYear: number;
} {
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  const startYear = month >= fyStartMonth ? year : year - 1;
  return { startYear, endYear: startYear + 1 };
}

export function generateBasPeriods({
  fiscalYearStart,
  frequency,
  fyStartMonth = DEFAULT_FY_START_MONTH
}: GenerateBasPeriodsInput): BasPeriod[] {
  const increments = getIncrementMonths(frequency);
  const periodCount = Math.ceil(MONTHS_IN_YEAR / increments);
  const yearLabel = formatFinancialYearLabel(fiscalYearStart);

  const absoluteStart = new Date(Date.UTC(fiscalYearStart, fyStartMonth - 1, 1));

  return Array.from({ length: periodCount }, (_, idx) => {
    const periodStart = addMonths(absoluteStart, idx * increments);
    const periodEnd = subtractDay(addMonths(periodStart, increments));

    return {
      label: formatPeriodLabel({ frequency, index: idx + 1, periodStart, yearLabel }),
      index: idx + 1,
      start: periodStart,
      end: periodEnd
    };
  });
}

function getIncrementMonths(frequency: BasFrequency): number {
  switch (frequency) {
    case "monthly":
      return 1;
    case "quarterly":
      return 3;
    case "annual":
    default:
      return 12;
  }
}

function addMonths(date: Date, months: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCMonth(copy.getUTCMonth() + months);
  return copy;
}

function subtractDay(date: Date): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() - 1);
  return copy;
}

export function formatFinancialYearLabel(fiscalYearStart: number): string {
  const endYear = fiscalYearStart + 1;
  const shorthand = endYear.toString().slice(-2);
  return `FY ${fiscalYearStart}-${shorthand}`;
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];

function formatPeriodLabel({
  frequency,
  index,
  periodStart,
  yearLabel
}: {
  frequency: BasFrequency;
  index: number;
  periodStart: Date;
  yearLabel: string;
}): string {
  if (frequency === "monthly") {
    return `${MONTH_NAMES[periodStart.getUTCMonth()]} ${yearLabel}`;
  }

  if (frequency === "quarterly") {
    return `Q${index} ${yearLabel}`;
  }

  return yearLabel;
}
