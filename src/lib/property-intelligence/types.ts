// Canonical property/domain foundation for Milestone 23.1 (Property
// Intelligence). This is a NEW, forward-looking domain layer — it does not
// replace or mirror src/types/property.ts (the current, backend-projected
// PropertySummary used by the live Competitive Analysis feature). See
// README.md in this directory for how the two relate.
//
// No Phase 1 provider-capability audit was available when this was built
// (see README.md "Decisions still required"). Per explicit product
// direction, every provider is treated as reliably supporting only
// name/url/rent/currency/city; every other field is optional/unknown until
// real audit data says otherwise. Nothing here fabricates a value a
// provider didn't actually give us.

export const PROPERTY_PROVIDERS = ["uhomes", "uniacco", "university_living", "gradding_homes"] as const;
export type PropertyProvider = (typeof PROPERTY_PROVIDERS)[number];

export type RentPeriod = "week" | "month" | "night" | "unknown";

export type PropertyAvailability = "available" | "unavailable" | "unknown";

// The smallest correct canonical representation of one accommodation
// listing, normalized from whatever a provider actually returned. Every
// field beyond `provider` and `propertyId` may be null/empty — providers
// are not required to supply anything they can't reliably provide.
export interface CanonicalProperty {
  provider: PropertyProvider;
  // Raw ID as given by the provider, if any. Null when the provider does
  // not expose a stable per-listing ID (see identity.ts for the fallback).
  providerPropertyId: string | null;
  // Deterministic canonical identity — see identity.ts. Two CanonicalProperty
  // records with the same propertyId are considered the same listing.
  propertyId: string;
  name: string;
  url: string | null;
  slug: string | null;
  image: string | null;
  images: string[];
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  rent: number | null;
  currency: string | null;
  rentPeriod: RentPeriod;
  // Derived for cross-provider comparison (providers quote in different
  // billing periods) — null unless rent+rentPeriod are both confidently
  // known, never estimated from a partial/unknown period. Added Milestone
  // 23.3, following the same real-world precedent as the IVYHUTS backend's
  // own AccommodationResidence.priceWeekly.
  rentPerWeek: number | null;
  roomType: string | null;
  // People sharing the room (1 = single/private). Null when the provider's
  // room-type text couldn't be confidently parsed into a number — see
  // normalizeSharing in normalize.ts.
  sharing: number | null;
  availability: PropertyAvailability;
  amenities: string[];
  // ISO 8601 timestamp of when the provider last updated this listing, if
  // the provider exposes one.
  sourceUpdatedAt: string | null;
  // Straight-line (Haversine) distance from the resolved university, in
  // km. Null whenever either the university or the property is missing
  // real coordinates — never estimated from city names (Milestone 23.3
  // Part 9). Filled in by the search layer, never by normalization itself
  // (normalizeProviderProperty has no university context to compute it
  // from).
  distanceFromUniversityKm: number | null;
  // Provider-specific fields that don't fit the canonical model. Kept
  // isolated here — CRM components must never read this bag directly; it
  // exists so adapter code doesn't need to silently drop provider data.
  providerMeta: Record<string, unknown> | null;
}

// One canonical search request. The minimum valid search is
// university + budget (min and/or max) + sharing — everything else is
// optional Discovery-stage refinement and must stay optional.
export interface PropertySearchCriteria {
  university: string;
  universityCoordinates?: { latitude: number; longitude: number } | null;
  city?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency?: string | null;
  sharing: number;
  roomType?: string | null;
  moveInDate?: string | null;
  stayDuration?: number | null;
  preferredDistance?: number | null;
}

export type CriteriaValidation = { valid: true } | { valid: false; missing: string[] };

// Enforces only the three hard minimums from the business objective —
// university, budget, sharing. Every other PropertySearchCriteria field
// must remain optional; do not add checks for Discovery-stage fields here.
export function validateMinimumCriteria(criteria: PropertySearchCriteria): CriteriaValidation {
  const missing: string[] = [];
  if (!criteria.university || !criteria.university.trim()) missing.push("university");
  if (criteria.budgetMin == null && criteria.budgetMax == null) missing.push("budget");
  if (criteria.sharing == null || Number.isNaN(criteria.sharing) || criteria.sharing <= 0) {
    missing.push("sharing");
  }
  return missing.length ? { valid: false, missing } : { valid: true };
}
