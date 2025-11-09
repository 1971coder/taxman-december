import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { renderWithProviders, setupFetchMock } from "../../../test-utils";
import EmployeesPage from "..";

describe("EmployeesPage", () => {
  it("lists employees and creates new entries", async () => {
    const fetchMock = setupFetchMock({
      "/api/employees": {
        GET: {
          body: {
            data: [
              {
                id: "emp-1",
                fullName: "Alice",
                email: "alice@example.com",
                baseRateCents: 10000,
                defaultUnit: "hour",
                superContributionPercent: 11
              }
            ]
          }
        },
        POST: ({ body }) => ({ body: { data: { id: "emp-2", ...body } } })
      }
    });

    renderWithProviders(<EmployeesPage />);

    expect(await screen.findByText("Alice")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/full name/i), "Bob");
    await userEvent.type(screen.getByLabelText(/email/i), "bob@example.com");
    await userEvent.selectOptions(screen.getByLabelText(/default unit/i), "day");
    await userEvent.type(screen.getByLabelText(/base rate/i), "9000");
    await userEvent.type(screen.getByLabelText(/super contribution/i), "9.5");
    await userEvent.click(screen.getByRole("button", { name: /save employee/i }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([url, init]) =>
        typeof url === "string" && url.includes("/api/employees") && (init?.method ?? "GET") === "POST"
      );
      expect(postCall).toBeTruthy();
      const [, init] = postCall!;
      expect(init?.body).toContain("\"fullName\":\"Bob\"");
      expect(init?.body).toContain("\"defaultUnit\":\"day\"");
      expect(init?.body).toContain("\"superContributionPercent\":9.5");
    });
  });

  it("allows editing and deleting employees", async () => {
    const fetchMock = setupFetchMock({
      "/api/employees": {
        GET: {
          body: {
            data: [
              {
                id: "emp-1",
                fullName: "Alice",
                email: "alice@example.com",
                baseRateCents: 10000,
                defaultUnit: "hour",
                superContributionPercent: 11
              }
            ]
          }
        }
      },
      "/api/employees/emp-1": {
        PUT: ({ body }) => ({ body: { data: { id: "emp-1", ...body } } }),
        DELETE: { status: 204, body: null }
      }
    });

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderWithProviders(<EmployeesPage />);

    expect(await screen.findByText("Alice")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /edit/i }));

    await userEvent.clear(screen.getByLabelText(/base rate/i));
    await userEvent.type(screen.getByLabelText(/base rate/i), "12000");
    await userEvent.clear(screen.getByLabelText(/super contribution/i));
    await userEvent.type(screen.getByLabelText(/super contribution/i), "12");
    await userEvent.click(screen.getByRole("button", { name: /update employee/i }));

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(([url, init]) =>
        typeof url === "string" && url.includes("/api/employees/emp-1") && (init?.method ?? "GET") === "PUT"
      );
      expect(putCall).toBeTruthy();
      const [, init] = putCall!;
      expect(init?.body).toContain("\"baseRateCents\":12000");
      expect(init?.body).toContain("\"superContributionPercent\":12");
    });

    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => {
      const deleteCall = fetchMock.mock.calls.find(([url, init]) =>
        typeof url === "string" && url.includes("/api/employees/emp-1") && (init?.method ?? "GET") === "DELETE"
      );
      expect(deleteCall).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });
});
