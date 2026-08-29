// Wraps the IVYHUTS backend's existing auth endpoints
// (api/auth/login.js, logout.js, me.js — Redis-backed sessions, see
// api/_lib/session.js there). This module never stores a password or
// session id itself; the backend holds the session, this only relays the
// HttpOnly cookie it sets via `credentials: "include"` (src/lib/api/client.ts).
//
// NOTE: signup is intentionally not wrapped here. The CRM is a tool for
// MARKETING_AGENT/MARKETING_MANAGER/ADMIN staff (see src/types/auth.ts) —
// account creation/role assignment for those is expected to be a staff/admin
// action, not a public self-serve signup form. Revisit if that assumption
// turns out to be wrong.
import { apiRequest, ApiRequestError } from "@/lib/api/client";
import type { SessionUser } from "@/types/auth";

interface AuthOkResponse {
  ok: true;
  user: SessionUser;
}

export async function login(email: string, password: string): Promise<SessionUser> {
  const res = await apiRequest<AuthOkResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  return res.user;
}

export async function logout(): Promise<void> {
  await apiRequest<{ ok: true }>("/api/auth/logout", { method: "POST" });
}

// Returns null on a 401 (not logged in) instead of throwing — that's an
// expected, normal outcome here, not a failure.
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const res = await apiRequest<AuthOkResponse>("/api/auth/me", { method: "GET" });
    return res.user;
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 401) {
      return null;
    }
    throw err;
  }
}
