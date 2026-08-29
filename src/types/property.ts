// The 4 real, canonical accommodation sources — Amber is deliberately not
// one of these (see sourceLabel below for how a historical Amber-sourced
// record is still displayed, read-only).
export const PROPERTY_SOURCES = ["uhomes", "uniacco", "university_living", "gradding_homes"] as const;
export type PropertySource = (typeof PROPERTY_SOURCES)[number];

export const PROPERTY_SOURCE_LABELS: Record<PropertySource, string> = {
  uhomes: "UHomes",
  uniacco: "UniAcco",
  university_living: "University Living",
  gradding_homes: "Gradding Homes",
};

// Historical Competitive Analysis records saved before this milestone may
// still carry `source: "amber"` — this is read-only display support for
// those, never a value new search results can produce (the search endpoint
// never returns it). See src/components/competitive-analysis/*.tsx.
export function sourceLabel(source: string | null | undefined): string {
  if (!source) return "Unknown source";
  if (source === "amber") return "Amber (legacy)";
  return PROPERTY_SOURCE_LABELS[source as PropertySource] || source;
}


// ══════════════════════════════════════════════════════════════════════
// Find Rooms (Milestone 23.3) — the REAL GET /api/properties/search
// contract, verified directly against the backend's api/properties/
// search.js + api/_lib/providers/accommodation/*. Despite sharing a URL
// path with the aspirational PropertySearchResult above, this is a
// different, real contract: query params are university/budget/sharing
// (not city/limit), and results are CanonicalProperty (Milestone 23.1),
// not PropertySummary. See src/lib/api/properties.ts's searchFindRooms.
// ══════════════════════════════════════════════════════════════════════

// Mirrors api/_lib/providers/accommodation/types.js's PROVIDER_STATUSES —
// keep in sync if that ever changes.
export const PROVIDER_COVERAGE_STATUSES = ["SEARCHED", "NO_RESULTS", "UNAVAILABLE", "NOT_CONFIGURED", "ERROR"] as const;
export type ProviderCoverageStatus = (typeof PROVIDER_COVERAGE_STATUSES)[number];

export interface ProviderCoverageEntry {
  provider: PropertySource;
  status: ProviderCoverageStatus;
  count: number;
  reason?: string;
}

export interface FindRoomsUniversityInput {
  id?: string | null;
  name: string;
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

// The minimum valid Find Rooms search is university + budget (min and/or
// max) + sharing — no call/Discovery completion required. Coordinates, if
// present, are search input only (see the backend route's own comment) —
// never sent as identity/authorization.
export interface FindRoomsSearchCriteria {
  university: FindRoomsUniversityInput;
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency?: string | null;
  sharing: number;
  roomType?: string | null;
  moveInDate?: string | null;
  stayDurationMonths?: number | null;
  preferredDistance?: number | null;
  amenities?: string[];
}

export interface FindRoomsSearchMetadata {
  searchedAt: string;
  university: FindRoomsUniversityInput;
  criteria: Omit<FindRoomsSearchCriteria, "university">;
  // Deliberately never claims "all available properties" — see the
  // backend route's own comment (Milestone 23.2 Part 10).
  disclaimer: string;
}

export interface FindRoomsSearchResult {
  // CanonicalProperty (Milestone 23.1) — imported from property-intelligence
  // rather than redefined here, so the domain-layer shape and the real
  // backend response shape can never silently drift apart.
  properties: import("@/lib/property-intelligence").CanonicalProperty[];
  providerCoverage: ProviderCoverageEntry[];
  searchMetadata: FindRoomsSearchMetadata;
}
