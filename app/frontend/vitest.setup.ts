import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
