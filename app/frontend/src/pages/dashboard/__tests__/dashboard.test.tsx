import { screen } from "@testing-library/react";

import { renderWithProviders } from "../../../test-utils";
import DashboardPage from "..";

describe("DashboardPage", () => {
  it("renders key dashboard tiles", () => {
    renderWithProviders(<DashboardPage />);

    expect(
      screen.getByRole("heading", { name: /today/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /upcoming bas/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Quick stats for drafts, overdue invoices, and BAS tasks/i)
    ).toBeInTheDocument();
  });
});
