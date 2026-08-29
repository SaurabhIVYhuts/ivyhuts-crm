// The CRM's own business roles (mirrors USER_ROLES in
// api/_lib/models/User.js on the ivyhuts-website backend). Role lives on
// the MongoDB User document, never in the Redis session — see
// src/lib/api/customers.ts's getCurrentCustomer.
export type Role = "USER" | "MARKETING_AGENT" | "MARKETING_MANAGER" | "ADMIN";

// Roles the CRM is intended for (see api/_lib/businessAuth.js's
// INTERNAL_ROLES on the backend). Frontend checks using this are UX only —
// the backend re-checks the role on every request and is the only
// authoritative gate.
export const INTERNAL_ROLES: Role[] = ["MARKETING_AGENT", "MARKETING_MANAGER", "ADMIN"];

// Roles authorized to schedule/reschedule/cancel a meeting (see
// api/leads/[id]/meetings/index.js and .../[meetingId]/index.js's own
// MANAGEMENT_ROLES on the backend, which is the authoritative enforcement).
// A MARKETING_AGENT can still view meetings and update everything about one
// except when or whether it happens. Frontend use of this is UX only.
export const MANAGEMENT_ROLES: Role[] = ["MARKETING_MANAGER", "ADMIN"];

// GET /api/auth/me / POST /api/auth/login /signup all return this shape
// (api/_lib/userStore.js's `toSafeUser`) — the Redis-backed identity record.
// Deliberately minimal: no role, no business/marketing fields. For those,
// see CustomerProfile in src/types/customer.ts.
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}
