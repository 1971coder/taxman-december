import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders, setupFetchMock } from "../../../test-utils";
import InvoicesPage from "..";

describe("InvoicesPage", () => {
  it("auto-fills rates and submits invoices", async () => {
    const fetchMock = setupFetchMock({
      "/api/clients": {
        GET: { body: { data: [
          { id: "client-1", displayName: "Acme Pty", contactEmail: "acme@example.com", defaultRateCents: 0 }
        ] } }
      },
      "/api/employees": {
        GET: { body: { data: [
          { id: "emp-1", fullName: "Consultant", email: "c@example.com", baseRateCents: 9000, defaultUnit: "hour" }
        ] } }
      },
      "/api/gst-codes": {
        GET: { body: { data: [{ id: "gst", code: "GST", ratePercent: 10 }] } }
      },
      "/api/client-rates?clientId=client-1": {
        GET: { body: { data: [
          {
            id: "rate-1",
            clientId: "client-1",
            employeeId: "emp-1",
            rateCents: 12500,
            unit: "hour",
            effectiveFrom: "2024-07-01",
            effectiveTo: null
          }
        ] } }
      },
      "/api/invoices": {
        GET: { body: { data: [] } },
        POST: ({ body }) => ({ body: { data: { id: "inv-1", ...body } } })
      }
    });

    renderWithProviders(<InvoicesPage />);

    const clientSelect = await screen.findByLabelText(/client/i);
    await screen.findByRole("option", { name: "Acme Pty" });
    await act(async () => {
      await userEvent.selectOptions(clientSelect, "client-1");
    });

    const employeeSelect = document.querySelector('select[name="lines.0.employeeId"]') as HTMLSelectElement;
    await act(async () => {
      await userEvent.selectOptions(employeeSelect, "emp-1");
    });

    const rateInput = document.querySelector('input[name="lines.0.rate"]') as HTMLInputElement;
    await waitFor(() => {
      expect(rateInput).toHaveValue(125);
    });

    await userEvent.clear(rateInput);
    await userEvent.type(rateInput, "130");

    const descriptionField = document.querySelector('textarea[name="lines.0.description"]') as HTMLTextAreaElement;
    const quantityField = document.querySelector('input[name="lines.0.quantity"]') as HTMLInputElement;
    const gstSelect = document.querySelector('select[name="lines.0.gstCodeId"]') as HTMLSelectElement;

    await userEvent.type(descriptionField, "Monthly retainer");
    await userEvent.clear(quantityField);
    await userEvent.type(quantityField, "2");
    await userEvent.selectOptions(gstSelect, "gst");
    await userEvent.type(screen.getByLabelText(/cash received date/i), "2024-07-10");

    expect(screen.getByText(/Line total: \$260\.00/)).toBeInTheDocument();
  });
});
