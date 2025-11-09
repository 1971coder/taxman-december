import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders, setupFetchMock } from "../../../test-utils";
import ClientsPage from "..";

describe("ClientsPage", () => {
  it("renders client list, submits new clients, and updates existing ones", async () => {
    const fetchMock = setupFetchMock({
      "/api/clients": {
        GET: {
          body: {
            data: [
              {
                id: "client-1",
                displayName: "Acme Pty",
                contactEmail: "acme@example.com",
                defaultRateCents: 12000,
                address: "1 Example Street"
              },
              {
                id: "client-2",
                displayName: "Beta Pty",
                contactEmail: "beta@example.com",
                defaultRateCents: null,
                address: null
              }
            ]
          }
        },
        POST: ({ body }) => ({ body: { data: { id: "client-new", ...body } } })
      },
      "/api/clients/client-1": {
        PUT: ({ body }) => ({ body: { data: { id: "client-1", ...body } } })
      },
      "/api/employees": {
        GET: { body: { data: [
          { id: "emp-1", fullName: "Employee One", email: "one@example.com", baseRateCents: 10000, defaultUnit: "hour" }
        ] } }
      },
      "/api/client-rates?clientId=client-1": {
        GET: { body: { data: [
          { id: "rate-1", clientId: "client-1", employeeId: "emp-1", rateCents: 15000, unit: "hour", effectiveFrom: "2024-07-01", effectiveTo: null, employeeName: "Employee One" }
        ] } }
      },
      "/api/client-rates?clientId=client-2": {
        GET: { body: { data: [] } }
      }
    });

    renderWithProviders(<ClientsPage />);

    expect(await screen.findByText("Acme Pty")).toBeInTheDocument();
    expect(screen.getByText("Beta Pty")).toBeInTheDocument();
    expect(screen.getByText("1 Example Street")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Employee One/)).toBeInTheDocument();
    });

    const newClientCard = screen.getByRole("heading", { name: "New Client" }).closest("div");
    if (!newClientCard) {
      throw new Error("New client card not found");
    }

    await userEvent.type(within(newClientCard).getByLabelText(/display name/i), "Gamma Co");
    await userEvent.type(
      within(newClientCard).getByLabelText(/contact email/i),
      "gamma@example.com"
    );
    await userEvent.type(within(newClientCard).getByLabelText(/address/i), "123 Billing Rd");
    await userEvent.type(
      within(newClientCard).getByLabelText(/default rate \(cents\)/i),
      "12500"
    );
    await userEvent.click(within(newClientCard).getByRole("button", { name: /save client/i }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([url, init]) =>
        typeof url === "string" && url.includes("/api/clients") && (init?.method ?? "GET") === "POST"
      );
      expect(postCall).toBeTruthy();
      const [, init] = postCall!;
      expect(init?.body).toContain("Gamma Co");
      expect(init?.body).toContain("123 Billing Rd");
    });

    const editClientCard = screen.getByRole("heading", { name: "Edit Client" }).closest("div");
    if (!editClientCard) {
      throw new Error("Edit client card not found");
    }

    const addressField = within(editClientCard).getByLabelText(/address/i);
    await userEvent.clear(addressField);
    await userEvent.type(addressField, "Suite 200\nUpdated City");
    await userEvent.click(within(editClientCard).getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(([url, init]) =>
        typeof url === "string" && url.includes("/api/clients/client-1") && (init?.method ?? "GET") === "PUT"
      );
      expect(putCall).toBeTruthy();
      const [, init] = putCall!;
      expect(init?.body).toContain("Suite 200\\nUpdated City");
    });
  });
});
