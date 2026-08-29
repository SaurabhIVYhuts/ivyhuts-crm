// Central HTTP client for every call to the IVYHUTS backend. Nothing in
// this codebase should call `fetch()` directly against a backend URL —
// route it through this module (or a src/lib/api/*.ts wrapper around it)
// instead. See CLAUDE.md / project README for the architecture rule.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_BASE_URL) {
  // Thrown lazily (inside apiRequest) rather than at import time, so this
  // module can still be imported during build/prerendering without a
  // configured backend.
  console.warn(
    "[api/client] NEXT_PUBLIC_API_URL is not set — API requests will fail. See .env.local."
  );
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

export type QueryValue = string | number | boolean | undefined | null;

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  query?: Record<string, QueryValue>;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  if (!API_BASE_URL) {
    throw new ApiRequestError(0, "NEXT_PUBLIC_API_URL is not configured.");
  }
  const base = API_BASE_URL.replace(/\/$/, "");
  const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

// Every backend response observed so far comes as either:
//  - business API (leads/customers/enquiries): { success, data, ... } /
//    { success: false, error: { code, message } }
//  - legacy auth endpoints (api/auth/*):        { ok, ... } /
//    { ok: false, error, message }
// This helper normalizes both into a thrown ApiRequestError on failure.
interface KnownErrorShape {
  success?: false;
  ok?: false;
  error?: string | { code?: string; message?: string };
  message?: string;
}

async function parseErrorPayload(response: Response): Promise<never> {
  let payload: KnownErrorShape | null = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const errorField = payload?.error;
  const message =
    (typeof errorField === "object" ? errorField?.message : undefined) ??
    payload?.message ??
    `Request failed with status ${response.status}`;
  const code = typeof errorField === "object" ? errorField?.code : errorField;

  throw new ApiRequestError(response.status, message, code);
}

// Sends the IVYHUTS session cookie (see backend api/_lib/session.js) on
// every request via `credentials: "include"`. Note: as of this writing the
// backend does not yet send CORS headers or a cross-site-compatible
// SameSite cookie policy for a separate-origin frontend like this CRM — see
// the "Backend API information still required" note in the project README.
async function performRequest(path: string, options: ApiRequestOptions): Promise<Response> {
  const { body, query, headers, ...rest } = options;
  const url = buildUrl(path, query);

  const response = await fetch(url, {
    ...rest,
    method: options.method ?? (body !== undefined ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    await parseErrorPayload(response);
  }
  return response;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const response = await performRequest(path, options);
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

// For binary responses (e.g. a generated .pptx download) — same URL
// building, auth cookie, and error normalization as apiRequest, just
// without assuming a JSON body on success. See src/lib/api/presentations.ts.
export async function apiRequestBlob(path: string, options: ApiRequestOptions = {}): Promise<Blob> {
  const response = await performRequest(path, options);
  return response.blob();
}
