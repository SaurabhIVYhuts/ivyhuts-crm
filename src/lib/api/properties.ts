// searchFindRooms below is the REAL contract: verified directly against
// api/properties/search.js -> api/_lib/providers/accommodation/* on the
// IVYHUTS backend, Milestone 23.3. It fans out to the four approved
// accommodation sources (UHomes, UniAcco, University Living, Gradding
// Homes) server-side and returns CanonicalProperty results plus a
// per-provider coverage map. The CRM never talks to any provider directly
// and never talks to Amber for this feature. Internal-role only
// (requireRole on the backend) — callers of searchFindRooms MUST only
// invoke it on an explicit agent action (e.g. a "Find Rooms" button),
// never on a timer, on every keystroke, or automatically on page load.
//
// Milestone 23.15: removed the dead searchProperties(city, limit) function
// that used to live here — it was written against a hypothetical GET
// /api/properties/search(city, limit) contract that never existed
// backend-side (confirmed absent, Milestone 23.2 audit), and its only
// claimed caller (a Competitive Analysis property picker) no longer exists
// in this repository either (confirmed zero references anywhere). Removed
// together with its now-unused PropertySearchResult/ProviderSourceStatus/
// PropertySummary types in src/types/property.ts.
import { apiRequest } from "./client";
import type { ApiSuccessResponse } from "@/types/api";
import type { FindRoomsSearchCriteria, FindRoomsSearchResult } from "@/types/property";

export async function searchFindRooms(criteria: FindRoomsSearchCriteria): Promise<FindRoomsSearchResult> {
  const res = await apiRequest<ApiSuccessResponse<FindRoomsSearchResult>>("/api/properties/search", {
    method: "GET",
    query: {
      universityId: criteria.university.id ?? undefined,
      universityName: criteria.university.name,
      universityCity: criteria.university.city ?? undefined,
      universityCountry: criteria.university.country ?? undefined,
      universityLatitude: criteria.university.latitude ?? undefined,
      universityLongitude: criteria.university.longitude ?? undefined,
      budgetMin: criteria.budgetMin ?? undefined,
      budgetMax: criteria.budgetMax ?? undefined,
      currency: criteria.currency ?? undefined,
      sharing: criteria.sharing,
      roomType: criteria.roomType ?? undefined,
      moveInDate: criteria.moveInDate ?? undefined,
      stayDurationMonths: criteria.stayDurationMonths ?? undefined,
      preferredDistance: criteria.preferredDistance ?? undefined,
      amenities: criteria.amenities?.length ? criteria.amenities.join(",") : undefined,
    },
  });
  return res.data;
}
