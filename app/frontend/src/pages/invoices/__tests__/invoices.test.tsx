import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { renderWithProviders, setupFetchMock } from "../../../test-utils";
import InvoicesPage from "..";

const BASE_FETCH_ROUTES = {
  "/api/clients": {
    GET: {
      body: {
        data: [
          { id: "client-1", displayName: "Acme Pty", contactEmail: "acme@example.com", defaultRateCents: 0, paymentTermsDays: 14 }
        ]
      }
    }
  },
  "/api/employees": {
    GET: {
      body: {
        data: [
          {
            id: "emp-1",
            fullName: "Consultant",
            email: "c@example.com",
            baseRateCents: 9000,
            defaultUnit: "hour",
            superContributionPercent: 11
          }
        ]
      }
    }
  },
  "/api/gst-codes": {
    GET: { body: { data: [{ id: "gst", code: "GST", ratePercent: 10 }] } }
  },
  "/api/client-rates?clientId=client-1": {
    GET: {
      body: {
        data: [
          {
            id: "rate-1",
            clientId: "client-1",
            employeeId: "emp-1",
            rateCents: 12500,
            unit: "hour",
            effectiveFrom: "2024-07-01",
            effectiveTo: null
          }
        ]
      }
    }
  }
} as const;

describe("InvoicesPage", () => {
  it("auto-fills rates and submits invoices", async () => {
    const fetchMock = setupFetchMock({
      ...BASE_FETCH_ROUTES,
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

    await userEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/invoices", expect.objectContaining({ method: "POST" })));
  });

  it("loads an invoice for editing and submits updates", async () => {
    let lastPutBody: Record<string, unknown> | undefined;
    setupFetchMock({
      ...BASE_FETCH_ROUTES,
      "/api/invoices": {
        GET: {
          body: {
            data: [
              {
                id: "inv-1",
                invoiceNumber: 1,
                clientId: "client-1",
                issueDate: "2024-07-01",
                cashReceivedDate: null,
                clientName: "Acme Pty",
                status: "draft",
                totalIncCents: 11000
              }
            ]
          }
        }
      },
      "/api/invoices/inv-1": {
        GET: {
          body: {
            data: {
              id: "inv-1",
              invoiceNumber: 1,
              clientId: "client-1",
              issueDate: "2024-07-01",
              dueDate: "2024-07-08",
              cashReceivedDate: null,
              reference: "INV-0001",
              notes: "First draft",
              status: "draft",
              totalExCents: 10000,
              totalGstCents: 1000,
              totalIncCents: 11000,
              lines: [
                {
                  id: "line-1",
                  employeeId: "emp-1",
                  description: "Consulting",
                  quantity: 1,
                  unit: "hour",
                  rate: 100,
                  gstCodeId: "gst",
                  overrideRate: true
                }
              ]
            }
          }
        },
        PUT: ({ body }) => {
          lastPutBody = body as Record<string, unknown>;
          return { body: { data: { id: "inv-1", ...body } } };
        }
      }
    });

    renderWithProviders(<InvoicesPage />);

    const editButton = await screen.findByRole("button", { name: /edit/i });
    await userEvent.click(editButton);

    await screen.findByText(/Edit Invoice #1/);
    const notesField = screen.getByLabelText(/notes/i) as HTMLTextAreaElement;
    await userEvent.clear(notesField);
    await userEvent.type(notesField, "Updated invoice");

    await userEvent.click(screen.getByRole("button", { name: /update invoice/i }));

    await waitFor(() => expect(lastPutBody).toBeDefined());
    expect(lastPutBody).toMatchObject({ notes: "Updated invoice" });
    await screen.findByText(/New Invoice/);
  });

  it("deletes an invoice after confirmation", async () => {
    let invoices = [
      {
        id: "inv-1",
        invoiceNumber: 1,
        clientId: "client-1",
        issueDate: "2024-07-01",
        cashReceivedDate: null,
        clientName: "Acme Pty",
        status: "draft",
        totalIncCents: 11000
      }
    ];

    const fetchMock = setupFetchMock({
      ...BASE_FETCH_ROUTES,
      "/api/invoices": {
        GET: () => ({ body: { data: invoices } })
      },
      "/api/invoices/inv-1": {
        DELETE: () => {
          invoices = [];
          return { status: 204, body: null };
        }
      }
    });

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderWithProviders(<InvoicesPage />);

    const deleteButton = await screen.findByRole("button", { name: /delete/i });
    await userEvent.click(deleteButton);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/invoices/inv-1", expect.objectContaining({ method: "DELETE" }))
    );
    await screen.findByText(/No invoices yet/i);
    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
