// Wraps GET /api/staff on the IVYHUTS backend (api/staff.js). Contract
// verified directly against that source — internal roles only, used to
// populate the Lead assignment dropdown with real staff, never a fake or
// hardcoded agent list.
import { apiRequest } from "./client";
import type { ApiSuccessResponse } from "@/types/api";
import type { StaffUser } from "@/types/staff";

export function listStaff() {
  return apiRequest<ApiSuccessResponse<StaffUser[]>>("/api/staff", { method: "GET" });
}
