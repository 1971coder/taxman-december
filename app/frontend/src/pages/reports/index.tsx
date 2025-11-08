import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { BasReportResponse, BasRequestInput, SettingsInput } from "@taxman/api-types";

import { apiFetch } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";

const DEFAULT_FY_START_MONTH = 7;
const SETTINGS_QUERY_KEY = ["settings"];

type BasFilters = Pick<BasRequestInput, "frequency" | "basis" | "fiscalYearStart" | "fyStartMonth">;

export default function ReportsPage() {
  const [filters, setFilters] = useState<BasFilters>(() => buildInitialFilters());
  const [request, setRequest] = useState<BasFilters>(() => buildInitialFilters());
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState(1);

  const settingsQuery = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () => apiFetch<{ data: SettingsInput | null }>("/settings")
  });

  useEffect(() => {
    const settings = settingsQuery.data?.data;
    if (!settings) {
      return;
    }
    const initial = buildInitialFilters(settings);
    setFilters(initial);
    setRequest(initial);
  }, [settingsQuery.data]);

  const basQuery = useQuery({
    queryKey: ["reports", "bas", request.frequency, request.basis, request.fiscalYearStart, request.fyStartMonth],
    queryFn: () => fetchBasReport(request),
    enabled: Boolean(request.fiscalYearStart)
  });

  const report = basQuery.data?.data;
  const periods = report?.periods ?? [];

  useEffect(() => {
    if (periods.length > 0) {
      setSelectedPeriodIndex(periods[0].period.index);
    }
  }, [periods.length, report?.request.frequency, report?.request.fiscalYearStart, report?.request.basis]);

  const selectedPeriod = useMemo(() => {
    return periods.find((entry) => entry.period.index === selectedPeriodIndex) ?? periods[0];
  }, [periods, selectedPeriodIndex]);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: "AUD",
        minimumFractionDigits: 2
      }),
    []
  );

  const summary = selectedPeriod?.summary;
  const exceptions = report?.exceptions ?? [];

  const handleCompute = () => {
    setRequest((prev) => {
      if (
        prev.frequency === filters.frequency &&
        prev.basis === filters.basis &&
        prev.fiscalYearStart === filters.fiscalYearStart &&
        prev.fyStartMonth === filters.fyStartMonth
      ) {
        void basQuery.refetch();
        return prev;
      }
      return { ...filters };
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>BAS Worksheet</CardTitle>
          <CardDescription>Compute 1A/1B totals by BAS frequency, basis, and FY.</CardDescription>
        </CardHeader>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select
              value={filters.frequency}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  frequency: event.target.value as BasFilters["frequency"]
                }))
              }
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>BAS Basis</Label>
            <Select
              value={filters.basis}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  basis: event.target.value as BasFilters["basis"]
                }))
              }
            >
              <option value="cash">Cash</option>
              <option value="accrual">Accrual</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>FY Start Year</Label>
            <Input
              type="number"
              min={2000}
              max={2100}
              value={filters.fiscalYearStart}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  fiscalYearStart: Number(event.target.value) || prev.fiscalYearStart
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>FY Start Month</Label>
            <Input
              type="number"
              min={1}
              max={12}
              value={filters.fyStartMonth}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  fyStartMonth: clampMonth(Number(event.target.value))
                }))
              }
            />
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Period</Label>
            <Select
              value={selectedPeriod ? String(selectedPeriod.period.index) : ""}
              onChange={(event) => setSelectedPeriodIndex(Number(event.target.value))}
              disabled={!periods.length}
            >
              {periods.map((period) => (
                <option key={period.period.index} value={String(period.period.index)}>
                  {period.period.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={handleCompute} disabled={basQuery.isFetching}>
              {basQuery.isFetching ? "Computing..." : "Compute BAS"}
            </Button>
            <Button variant="outline" disabled>
              Export CSV (Soon)
            </Button>
          </div>
        </div>
      </Card>

      {basQuery.isLoading && <Card className="text-sm text-slate-500">Loading BAS summary…</Card>}

      {basQuery.isError && (
        <Card className="text-sm text-red-600">
          Failed to load BAS report. Please adjust filters or try again.
        </Card>
      )}

      {report && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedPeriod?.period.label ?? "Period"} · {report.fiscalYearLabel}
              </CardTitle>
              <CardDescription>
                {summary
                  ? `${summary.periodStart} → ${summary.periodEnd} · ${capitalize(summary.basis)} basis`
                  : "Select a period to view totals."}
              </CardDescription>
            </CardHeader>
            {summary ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <SummaryStat label="Sales (G1)" value={formatCurrency(summary.salesExCents, currencyFormatter)} />
                <SummaryStat label="GST on Sales (1A)" value={formatCurrency(summary.salesGstCents, currencyFormatter)} />
                <SummaryStat
                  label="Purchases (G11)"
                  value={formatCurrency(summary.purchasesExCents, currencyFormatter)}
                />
                <SummaryStat
                  label="GST on Purchases (1B)"
                  value={formatCurrency(summary.purchasesGstCents, currencyFormatter)}
                />
                <SummaryStat
                  label="Net GST"
                  value={formatCurrency(summary.netGstCents, currencyFormatter)}
                  highlight
                />
              </div>
            ) : (
              <p className="text-sm text-slate-500">No activity for this period yet.</p>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Exceptions</CardTitle>
              <CardDescription>Export unlocks once all blocking items are resolved.</CardDescription>
            </CardHeader>
            {exceptions.length === 0 ? (
              <p className="text-sm text-slate-500">No exceptions detected for this selection.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {exceptions.map((exception) => (
                  <li key={exception.id ?? exception.sourceId} className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                    <p className="font-medium text-amber-900">{exception.kind}</p>
                    <p className="text-amber-800">{exception.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function buildInitialFilters(settings?: SettingsInput | null): BasFilters {
  const fyStartMonth = settings?.fyStartMonth ?? DEFAULT_FY_START_MONTH;
  return {
    frequency: settings?.basFrequency ?? "quarterly",
    basis: settings?.gstBasis ?? "cash",
    fiscalYearStart: getFiscalYearStartForToday(fyStartMonth),
    fyStartMonth
  };
}

function getFiscalYearStartForToday(fyStartMonth: number) {
  const today = new Date();
  const month = today.getUTCMonth() + 1;
  const year = today.getUTCFullYear();
  return month >= fyStartMonth ? year : year - 1;
}

async function fetchBasReport(request: BasFilters) {
  const params = new URLSearchParams({
    frequency: request.frequency,
    basis: request.basis,
    fiscalYearStart: String(request.fiscalYearStart),
    fyStartMonth: String(request.fyStartMonth)
  });

  const response = await apiFetch<{ data: BasReportResponse }>(`/reports/bas?${params.toString()}`);
  return response;
}

function clampMonth(value: number) {
  if (Number.isNaN(value)) {
    return DEFAULT_FY_START_MONTH;
  }
  return Math.min(12, Math.max(1, value));
}

function formatCurrency(valueInCents: number, formatter: Intl.NumberFormat) {
  return formatter.format(valueInCents / 100);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function SummaryStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-4 ${highlight ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-slate-50"}`}
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
