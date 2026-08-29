// Wraps GET/POST /api/customers and GET /api/customers/me on the IVYHUTS
// backend (api/customers/index.js, api/customers/me.js). Contract verified
// directly against that source. GET /api/customers/:id (Customer 360) and
// PATCH endpoints are not wrapped yet — add them here once the CRM needs
// them, following the same pattern.
import { apiRequest } from "./client";
import type { QueryValue } from "./client";
import type { ApiCollectionResponse, ApiSuccessResponse } from "@/types/api";
import type { AccommodationJourneyStatus, CustomerProfile } from "@/types/customer";

export interface ListCustomersParams {
  [key: string]: QueryValue;
  page?: number;
  limit?: number;
  search?: string;
  status?: AccommodationJourneyStatus;
  source?: string;
  city?: string;
  createdFrom?: string;
  createdTo?: string;
}

export function listCustomers(params: ListCustomersParams = {}) {
  return apiRequest<ApiCollectionResponse<CustomerProfile>>("/api/customers", {
    method: "GET",
    query: params,
  });
}

// The logged-in visitor's own business profile (role, marketing, lead,
// accommodationJourney) — distinct from GET /api/auth/me, which only knows
// the Redis identity (id/name/email/phone). See src/types/auth.ts.
export function getCurrentCustomer() {
  return apiRequest<ApiSuccessResponse<CustomerProfile>>("/api/customers/me", { method: "GET" });
}

export interface CreateCustomerPayload {
  email: string;
  name: string;
  phone?: string;
  profile?: Partial<CustomerProfile["profile"]>;
  marketing?: Partial<CustomerProfile["marketing"]>;
}

// Internal roles only — staff-created/imported customer record.
export function createCustomer(payload: CreateCustomerPayload) {
  return apiRequest<ApiSuccessResponse<CustomerProfile>>("/api/customers", {
    method: "POST",
    body: payload,
  });
}
