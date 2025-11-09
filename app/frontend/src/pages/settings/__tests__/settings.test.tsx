import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders, setupFetchMock } from "../../../test-utils";
import SettingsPage from "..";

describe("SettingsPage", () => {
  it("loads settings and submits updates", async () => {
    const fetchMock = setupFetchMock({
      "/api/settings": {
        GET: { body: { data: { legalName: "Acme Pty Ltd", abn: "12345678901", gstBasis: "cash", basFrequency: "quarterly", fyStartMonth: 7 } } },
        PUT: ({ body }) => ({ body: { data: body } })
      },
      "/api/gst-codes": {
        GET: { body: { data: [{ id: "gst", code: "GST", description: "Standard", ratePercent: 10 }] } }
      }
    });

    renderWithProviders(<SettingsPage />);

    const legalNameInput = await screen.findByDisplayValue("Acme Pty Ltd");

    const abnInput = screen.getByLabelText(/abn/i);
    await userEvent.clear(abnInput);
    await userEvent.type(abnInput, "98765432109");

    await userEvent.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(([url, init]) =>
        typeof url === "string" && url.includes("/api/settings") && (init?.method ?? "GET") === "PUT"
      );
      expect(putCall).toBeTruthy();
      const [, init] = putCall!;
      const payload = init?.body ? JSON.parse(init.body as string) : undefined;
      expect(payload?.abn).toBe("98765432109");
    });
  });
});
