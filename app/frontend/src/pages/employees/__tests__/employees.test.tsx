import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders, setupFetchMock } from "../../../test-utils";
import EmployeesPage from "..";

describe("EmployeesPage", () => {
  it("lists employees and creates new entries", async () => {
    const fetchMock = setupFetchMock({
      "/api/employees": {
        GET: { body: { data: [
          { id: "emp-1", fullName: "Alice", email: "alice@example.com", baseRateCents: 10000, defaultUnit: "hour" }
        ] } },
        POST: ({ body }) => ({ body: { data: { id: "emp-2", ...body } } })
      }
    });

    renderWithProviders(<EmployeesPage />);

    expect(await screen.findByText("Alice")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/full name/i), "Bob");
    await userEvent.type(screen.getByLabelText(/email/i), "bob@example.com");
    await userEvent.selectOptions(screen.getByLabelText(/default unit/i), "day");
    await userEvent.type(screen.getByLabelText(/base rate/i), "9000");
    await userEvent.click(screen.getByRole("button", { name: /save employee/i }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([url, init]) =>
        typeof url === "string" && url.includes("/api/employees") && (init?.method ?? "GET") === "POST"
      );
      expect(postCall).toBeTruthy();
      const [, init] = postCall!;
      expect(init?.body).toContain("\"fullName\":\"Bob\"");
      expect(init?.body).toContain("\"defaultUnit\":\"day\"");
    });
  });
});
