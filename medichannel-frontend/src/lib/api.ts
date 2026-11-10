export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const requestHeaders = new Headers(options.headers ?? {});

  if (
    !(options.body instanceof FormData) &&
    !(options.body instanceof URLSearchParams) &&
    !requestHeaders.has("Content-Type")
  ) {
    requestHeaders.set("Content-Type", "application/json");
  }

  const response = await fetch(`/api/backend/${endpoint.replace(/^\/+/, "")}`, {
    ...options,
    credentials: "same-origin",
    headers: requestHeaders,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();

    if (!text) {
      throw new Error(`Request failed: ${response.status}`);
    }

    try {
      const parsed = JSON.parse(text) as { message?: string };
      throw new Error(parsed.message || text);
    } catch {
      throw new Error(text);
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();

  if (!text) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return JSON.parse(text) as T;
  }

  return text as unknown as T;
}
