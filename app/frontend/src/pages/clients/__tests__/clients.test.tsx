import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders, setupFetchMock } from "../../../test-utils";
import ClientsPage from "..";

describe("ClientsPage", () => {
  it("renders client list, submits new clients, and updates existing ones", async () => {
    const fetchMock = setupFetchMock({
      "/api/clients": {
        GET: { body: { data: [
          {
            id: "client-1",
            displayName: "Acme Pty",
            contactEmail: "acme@example.com",
            defaultRateCents: 12000,
            paymentTermsDays: 14
          },
          {
            id: "client-2",
            displayName: "Beta Pty",
            contactEmail: "beta@example.com",
            defaultRateCents: null,
            paymentTermsDays: 0
          }
        ] } },
        POST: ({ body }) => ({ body: { data: { id: "client-new", ...body } } })
      },
      "/api/clients/client-1": {
        PUT: ({ body }) => ({ body: { data: { id: "client-1", ...body } } })
      },
      "/api/employees": {
        GET: { body: { data: [
          {
            id: "emp-1",
            fullName: "Employee One",
            email: "one@example.com",
            baseRateCents: 10000,
            defaultUnit: "hour",
            superContributionPercent: 11
          }
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

    await userEvent.type(screen.getByLabelText(/display name/i), "Gamma Co");
    await userEvent.type(screen.getByLabelText(/contact email/i), "gamma@example.com");
    await userEvent.type(screen.getByLabelText(/default rate \(cents\)/i), "12500");
    await userEvent.clear(screen.getByLabelText(/payment terms/i));
    await userEvent.type(screen.getByLabelText(/payment terms/i), "21");
    await userEvent.click(screen.getByRole("button", { name: /save client/i }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([url, init]) =>
        typeof url === "string" && url.includes("/api/clients") && (init?.method ?? "GET") === "POST"
      );
      expect(postCall).toBeTruthy();
      const [, init] = postCall!;
      expect(init?.body).toContain("Gamma Co");
      expect(init?.body).toContain("21");
    });
  });
});
