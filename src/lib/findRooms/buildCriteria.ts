// Builds the exact FindRoomsSearchCriteria payload searchFindRooms() sends
// — the ONLY place this shape is assembled, so CriteriaPanel's form state
// and the actual outbound request can never drift apart. Pure function:
// no fetch, no side effects, directly testable for "correct query
// construction" without a network call.
import type { FindRoomsSearchCriteria, FindRoomsUniversityInput } from "@/types/property";
import type { ResolvedUniversity } from "@/types/university";
import type { FindRoomsRequirements } from "./requirements";

export interface FindRoomsFilters {
  roomType: string;
  moveInDate: string;
  stayDurationMonths: string;
  preferredDistance: string;
  amenities: string;
}

export const BLANK_FIND_ROOMS_FILTERS: FindRoomsFilters = {
  roomType: "",
  moveInDate: "",
  stayDurationMonths: "",
  preferredDistance: "",
  amenities: "",
};

// Falls back to the free-text Discovery university when resolution failed
// or hasn't completed yet — the university requirement only needs
// non-empty text (Milestone 23.5 Part 5); resolved coordinates are a
// bonus for distance calculation, never a search precondition.
export function buildUniversityInput(
  requirements: FindRoomsRequirements,
  resolved: ResolvedUniversity | null
): FindRoomsUniversityInput {
  if (resolved) {
    return {
      id: resolved.id,
      name: resolved.name,
      city: resolved.city,
      country: resolved.country,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
    };
  }
  return { name: requirements.university ?? "" };
}

function optionalNumber(value: string): number | undefined {
  return value.trim() === "" ? undefined : Number(value);
}

// Returns null when the three mandatory requirements aren't satisfied —
// callers must treat that as "cannot search", never fall back to sending
// a partial request.
export function buildFindRoomsCriteria(
  requirements: FindRoomsRequirements,
  resolved: ResolvedUniversity | null,
  filters: FindRoomsFilters
): FindRoomsSearchCriteria | null {
  if (!requirements.isComplete || requirements.sharing == null) return null;

  return {
    university: buildUniversityInput(requirements, resolved),
    budgetMin: requirements.budgetMin,
    budgetMax: requirements.budgetMax,
    currency: requirements.currency,
    sharing: requirements.sharing,
    roomType: filters.roomType.trim() || undefined,
    moveInDate: filters.moveInDate.trim() || undefined,
    stayDurationMonths: optionalNumber(filters.stayDurationMonths),
    preferredDistance: optionalNumber(filters.preferredDistance),
    amenities: filters.amenities
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean),
  };
}
