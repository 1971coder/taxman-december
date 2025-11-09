import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders, setupFetchMock } from "../../../test-utils";
import DataIoPage from "..";

describe("DataIoPage", () => {
  it("imports CSV rows and surfaces stats", async () => {
    const fetchMock = setupFetchMock({
      "/api/data/import": {
        POST: ({ body }) => ({ body: { data: { entity: body.entity, inserted: body.rows.length, updated: 0 } } })
      }
    });

    renderWithProviders(<DataIoPage />);

    const importButton = screen.getByRole("button", { name: /import csv/i });
    const fileInput = document.querySelector('input[accept=".csv,text/csv"]') as HTMLInputElement;
    const csvContents = "displayName,contactEmail\nGamma,gamma@example.com";
    const file = new File([csvContents], "clients.csv", { type: "text/csv" });
    (file as File & { text?: () => Promise<string> }).text = () => Promise.resolve(csvContents);

    await act(async () => {
      await userEvent.click(importButton);
    });

    Object.defineProperty(fileInput, "files", {
      value: [file],
      writable: false
    });

    await act(async () => {
      fireEvent.change(fileInput);
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/data/import"),
        expect.objectContaining({ method: "POST" })
      );
    });

    expect(await screen.findByText(/Imported 1 new/i)).toBeInTheDocument();
  });
});
