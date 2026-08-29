// Turns an ApiRequestError (see src/lib/api/client.ts) into a consistent,
// user-safe UI state. Centralized here so every backend-driven page reacts
// to 401/403/5xx the same way instead of re-deriving it per page.
import { ApiRequestError } from "@/lib/api/client";

export type ApiErrorKind = "auth" | "forbidden" | "not_found" | "server" | "unknown";

export interface ApiErrorState {
  kind: ApiErrorKind;
  message: string;
}

export function describeApiError(err: unknown): ApiErrorState {
  if (err instanceof ApiRequestError) {
    if (err.status === 401) {
      return { kind: "auth", message: "Your session has expired. Please sign in again." };
    }
    if (err.status === 403) {
      return {
        kind: "forbidden",
        message: err.message || "You don't have permission to view this.",
      };
    }
    if (err.status === 404) {
      return { kind: "not_found", message: "The requested record could not be found." };
    }
    if (err.status >= 500 || err.status === 0) {
      return {
        kind: "server",
        message: "Something went wrong loading this data. Please try again.",
      };
    }
    return { kind: "unknown", message: err.message || "Something went wrong." };
  }
  return { kind: "unknown", message: "Something went wrong. Please try again." };
}
