export interface ApiError extends Error {
  status?: number;
  details?: unknown;
}

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface FetchOptions<TBody> {
  method?: HttpMethod;
  body?: TBody;
  signal?: AbortSignal;
}

export async function apiFetch<TResponse, TBody = unknown>(
  path: string,
  options: FetchOptions<TBody> = {}
): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json"
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal
  });

  if (!response.ok) {
    const error: ApiError = new Error("API request failed");
    error.status = response.status;
    error.details = await safeJson(response);
    throw error;
  }

  return (await safeJson(response)) as TResponse;
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}
