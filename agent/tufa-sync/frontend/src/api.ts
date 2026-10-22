import type { Kind } from "./types";

export const API = "/api/v1/utilities";

export const invoicesPath = (kind: Kind) => `${API}/cis-invoices/${kind === "SALES" ? "sales" : "purchases"}`;

export interface ErrorPayload {
  message?: string;
  field?: string;
  hint?: string;
  /** CIS did not answer at all (down, or the connection dropped). */
  unreachable?: boolean;
  /** The app's own server did not answer. */
  offline?: boolean;
  cisError?: { faultEnv?: string; faultString?: string; faultCode?: string | null };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly payload: ErrorPayload = {},
  ) {
    super(payload.message || `HTTP ${status}`);
  }
}

let onUnauthorized = () => {};

/** Called when the server no longer has a certificate (it was restarted). */
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
  /** Which loaded certificate the request is for; the server uses the active one otherwise. */
  business?: string;
}

export async function api<T>(
  path: string,
  body?: unknown,
  { method = "POST", business }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (business) headers["X-Business"] = business;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const init: RequestInit = { method, cache: "no-store", credentials: "same-origin", headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError(0, { offline: true });
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && path.startsWith(API)) setTimeout(onUnauthorized, 0);
    throw new ApiError(response.status, payload ?? {});
  }
  return payload as T;
}
