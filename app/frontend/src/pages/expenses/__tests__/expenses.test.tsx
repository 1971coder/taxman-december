import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders, setupFetchMock } from "../../../test-utils";
import ExpensesPage from "..";

describe("ExpensesPage", () => {
  it("shows expenses and submits new ones with GST conversions", async () => {
    const fetchMock = setupFetchMock({
      "/api/expenses": {
        GET: { body: { data: [
          {
            id: "exp-1",
            supplierName: "Stationery Co",
            category: "Office",
            amountExCents: 5000,
            gstCents: 500,
            gstCodeId: "gst",
            incurredDate: "2024-07-01",
            notes: "Pens"
          }
        ] } },
        POST: ({ body }) => ({ body: { data: { id: "exp-2", ...body } } })
      },
      "/api/gst-codes": {
        GET: { body: { data: [{ id: "gst", code: "GST", ratePercent: 10 }] } }
      }
    });

    renderWithProviders(<ExpensesPage />);

    expect(await screen.findByText("Stationery Co")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/supplier/i), "IT Services");
    await userEvent.type(screen.getByLabelText(/category/i), "Technology");
    await userEvent.type(screen.getByLabelText(/amount ex gst/i), "100");
    await userEvent.type(screen.getByLabelText(/gst amount/i), "10");
    await userEvent.selectOptions(screen.getByLabelText(/gst code/i), "gst");
    fireEvent.change(screen.getByLabelText(/date/i), { target: { value: "2024-08-15" } });
    await userEvent.type(screen.getByLabelText(/attachment path/i), "/receipts/it.pdf");
    await userEvent.type(screen.getByLabelText(/notes/i), "Monthly retainer");
    await userEvent.click(screen.getByRole("button", { name: /save expense/i }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([url, init]) =>
        typeof url === "string" && url.includes("/api/expenses") && (init?.method ?? "GET") === "POST"
      );
      expect(postCall).toBeTruthy();
      const [, init] = postCall!;
      const payload = JSON.parse(init?.body as string);
      expect(payload.amountExCents).toBe(10000);
      expect(payload.gstCents).toBe(1000);
      expect(payload.incurredDate).toBe("2024-08-15");
    });
  });
});
