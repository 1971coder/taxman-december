import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

interface RenderOptions {
  route?: string;
}

export function renderWithProviders(ui: ReactElement, options: RenderOptions = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0
      }
    }
  });

  const { route = "/" } = options;

  return render(
    <MemoryRouter initialEntries={[route]}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>
  );
}

export interface FetchRequestInfo {
  url: string;
  method: string;
  body: JsonRecord;
}

export interface FetchResponseConfig {
  status?: number;
  body: unknown;
}

type JsonRecord = Record<string, any>;

type FetchHandler = FetchResponseConfig | ((request: FetchRequestInfo) => FetchResponseConfig | Promise<FetchResponseConfig>);

export type FetchMockMap = Record<string, Partial<Record<string, FetchHandler>>>;

export function setupFetchMock(routes: FetchMockMap) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const urlString = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const normalizedUrl = normalizeUrl(urlString);
    const method = (init.method ?? "GET").toUpperCase();
    const handler = routes[normalizedUrl]?.[method];

    if (!handler) {
      throw new Error(`No fetch handler for ${method} ${normalizedUrl}`);
    }

    const payload = parseJsonBody(init.body);
    const resolved =
      typeof handler === "function" ? await handler({ url: normalizedUrl, method, body: payload ?? {} }) : handler;
    const status = resolved.status ?? 200;

    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => resolved.body,
      text: async () => JSON.stringify(resolved.body)
    } as Response;
  });

  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  return fetchMock;
}

function normalizeUrl(url: string) {
  if (url.startsWith("http")) {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  }
  return url;
}

function parseJsonBody(body: unknown): JsonRecord | undefined {
  if (typeof body !== "string" || body.length === 0) {
    return undefined;
  }
  const parsed = safeJsonParse(body);
  return typeof parsed === "object" && parsed !== null ? (parsed as JsonRecord) : undefined;
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
}
