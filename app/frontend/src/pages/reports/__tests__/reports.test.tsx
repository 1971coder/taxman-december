import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders, setupFetchMock } from "../../../test-utils";
import ReportsPage from "..";

const today = new Date();
const initialFyStart = today.getUTCMonth() + 1 >= 7 ? today.getUTCFullYear() : today.getUTCFullYear() - 1;
const fyLabel = `FY ${initialFyStart}-${String(initialFyStart + 1).slice(-2)}`;
const quarterPath = `/api/reports/bas?frequency=quarterly&basis=cash&fiscalYearStart=${initialFyStart}&fyStartMonth=7`;
const monthlyPath = `/api/reports/bas?frequency=monthly&basis=cash&fiscalYearStart=${initialFyStart}&fyStartMonth=7`;

describe("ReportsPage", () => {
  it("computes BAS summaries with updated filters", async () => {
    const fetchMock = setupFetchMock({
      "/api/settings": {
        GET: { body: { data: { legalName: "Acme", abn: "12345678901", gstBasis: "cash", basFrequency: "quarterly", fyStartMonth: 7 } } }
      },
      [quarterPath]: {
        GET: { body: { data: {
          request: { frequency: "quarterly", basis: "cash", fiscalYearStart: initialFyStart, fyStartMonth: 7 },
          fiscalYearLabel: fyLabel,
          periods: [
            {
              period: { label: `Q1 ${fyLabel}`, index: 1, start: `${initialFyStart}-07-01`, end: `${initialFyStart}-09-30` },
              summary: {
                basis: "cash",
                periodStart: `${initialFyStart}-07-01`,
                periodEnd: `${initialFyStart}-09-30`,
                salesExCents: 100_000,
                salesGstCents: 10_000,
                purchasesExCents: 50_000,
                purchasesGstCents: 5_000,
                netGstCents: 5_000
              }
            }
          ],
          exceptions: []
        } } }
      },
      [monthlyPath]: {
        GET: { body: { data: {
          request: { frequency: "monthly", basis: "cash", fiscalYearStart: initialFyStart, fyStartMonth: 7 },
          fiscalYearLabel: fyLabel,
          periods: [
            {
              period: { label: `Jul ${fyLabel}`, index: 1, start: `${initialFyStart}-07-01`, end: `${initialFyStart}-07-31` },
              summary: {
                basis: "cash",
                periodStart: `${initialFyStart}-07-01`,
                periodEnd: `${initialFyStart}-07-31`,
                salesExCents: 40_000,
                salesGstCents: 4_000,
                purchasesExCents: 10_000,
                purchasesGstCents: 1_000,
                netGstCents: 3_000
              }
            }
          ],
          exceptions: []
        } } }
      }
    });

    renderWithProviders(<ReportsPage />);

    expect(await screen.findByText(/sales \(g1\)/i)).toBeInTheDocument();
    expect(screen.getByText("$1,000.00")).toBeInTheDocument();

    const frequencySelect = screen.getAllByRole("combobox")[0] as HTMLSelectElement;
    await userEvent.selectOptions(frequencySelect, "monthly");
    await userEvent.click(screen.getByRole("button", { name: /compute bas/i }));

    await waitFor(() => {
      const secondCall = fetchMock.mock.calls.find(([url]) =>
        typeof url === "string" && url.includes("frequency=monthly")
      );
      expect(secondCall).toBeTruthy();
    });

    expect(await screen.findByText(`Jul ${fyLabel}`)).toBeInTheDocument();
    expect(screen.getByText("$400.00")).toBeInTheDocument();
  });
});
