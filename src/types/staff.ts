// Mirrors api/_lib/staffView.js's toSafeStaff projection in the
// ivyhuts-website backend (GET /api/staff) — deliberately narrower than
// CustomerProfile: an internal staff member's assignable identity only.
import type { Role } from "@/types/auth";

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}
