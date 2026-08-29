// Translates between the CRM's in-memory shortlist state (shortlist.ts's
// ShortlistEntry[], reducer-driven, UI-shaped) and the persisted wire
// format (AccommodationCurationInput/AccommodationCuration, Milestone
// 23.6). Kept as its own module rather than folded into shortlist.ts —
// shortlist.ts stays pure UI-state logic with no knowledge of the backend
// contract; this is the one place that boundary is crossed.
import type { CanonicalProperty } from "@/lib/property-intelligence";
import type { AccommodationCuration, AccommodationCurationInput, CriteriaSnapshot, CuratedProperty } from "@/types/accommodationCuration";
import type { FindRoomsSearchCriteria } from "@/types/property";
import { toShortlistEntry, type ShortlistEntry } from "./shortlist";
import type { SearchedCriteriaSnapshot } from "./staleness";

// The last-searched FindRoomsSearchCriteria already matches
// CriteriaSnapshot field-for-field (Milestone 23.3's contract was designed
// with exactly this reuse in mind) — this is a type-narrowing pass-through,
// not a real transformation.
export function criteriaToSnapshot(criteria: FindRoomsSearchCriteria): CriteriaSnapshot {
  return {
    university: criteria.university,
    budgetMin: criteria.budgetMin ?? null,
    budgetMax: criteria.budgetMax ?? null,
    currency: criteria.currency ?? null,
    sharing: criteria.sharing,
    roomType: criteria.roomType ?? null,
    moveInDate: criteria.moveInDate ?? null,
    stayDurationMonths: criteria.stayDurationMonths ?? null,
    preferredDistance: criteria.preferredDistance ?? null,
    amenities: criteria.amenities ?? [],
  };
}

function entryToCuratedProperty(entry: ShortlistEntry): CuratedProperty {
  return {
    provider: entry.provider,
    providerPropertyId: entry.providerPropertyId,
    propertyId: entry.propertyId,
    name: entry.name,
    url: entry.url,
    slug: null,
    image: entry.image,
    city: entry.city,
    country: null,
    latitude: null,
    longitude: null,
    rent: entry.rent,
    rentPerWeek: entry.rentPerWeek,
    currency: entry.currency,
    rentPeriod: entry.rentPeriod,
    roomType: entry.roomType,
    sharing: entry.sharing,
    availability: "unknown",
    amenities: [],
    distanceFromUniversityKm: entry.distanceFromUniversityKm,
    advantages: entry.advantages.trim() === "" ? null : entry.advantages,
    disadvantages: entry.disadvantages.trim() === "" ? null : entry.disadvantages,
    providerMeta: null,
  };
}

// Builds the full PUT payload — the recommendation reason lives on
// whichever entry is currently marked recommended (Milestone 23.5's
// per-entry field); the backend only stores one, top-level, matching
// "at most one recommended property" (Milestone 23.6 Part 14).
export function shortlistToCurationInput(
  shortlist: ShortlistEntry[],
  criteriaSnapshot: CriteriaSnapshot | null,
  notes: string
): AccommodationCurationInput {
  const recommended = shortlist.find((e) => e.isRecommended) ?? null;
  return {
    criteriaSnapshot,
    properties: shortlist.map(entryToCuratedProperty),
    recommendedPropertyId: recommended?.propertyId ?? null,
    recommendationReason: recommended && recommended.recommendationReason.trim() !== "" ? recommended.recommendationReason : null,
    notes: notes.trim() === "" ? null : notes,
  };
}

function curatedPropertyToCanonical(property: CuratedProperty): CanonicalProperty {
  return {
    provider: property.provider,
    providerPropertyId: property.providerPropertyId,
    propertyId: property.propertyId,
    name: property.name,
    url: property.url,
    slug: property.slug,
    image: property.image,
    images: [],
    city: property.city,
    country: property.country,
    latitude: property.latitude,
    longitude: property.longitude,
    rent: property.rent,
    currency: property.currency,
    rentPeriod: property.rentPeriod,
    rentPerWeek: property.rentPerWeek,
    roomType: property.roomType,
    sharing: property.sharing,
    availability: property.availability,
    amenities: property.amenities,
    sourceUpdatedAt: null,
    distanceFromUniversityKm: property.distanceFromUniversityKm,
    providerMeta: property.providerMeta,
  };
}

// Narrows a full CriteriaSnapshot (persisted shape, university as an
// object) down to the same comparison shape deriveFindRoomsRequirements()
// produces (university as free text) — lets one criteriaChanged()
// comparator (staleness.ts) serve both "stale vs. last search" (Milestone
// 23.5) and "stale vs. last SAVE" (Milestone 23.6 Part 9), which compare
// against different snapshots but need the same shape to compare against
// live requirements.
export function criteriaSnapshotToStalenessSnapshot(snapshot: CriteriaSnapshot | null): SearchedCriteriaSnapshot | null {
  if (!snapshot) return null;
  return {
    university: snapshot.university.name,
    budgetMin: snapshot.budgetMin,
    budgetMax: snapshot.budgetMax,
    currency: snapshot.currency,
    sharing: snapshot.sharing,
  };
}

// Powers the "Saved / Unsaved changes" indicator (Milestone 23.6 Part
// 16) — a plain deep-equality check against the last-saved (or
// last-loaded) payload. Every field involved is plain serializable data,
// so JSON comparison is exact and side-effect-free; no need for a
// bespoke deep-equal implementation.
export function curationInputsEqual(a: AccommodationCurationInput, b: AccommodationCurationInput): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Hydrates persisted state back into the reducer's shape on load —
// recommendation/reason are restored onto the matching entry;
// advantages/disadvantages restore directly (they're already per-property
// on both sides).
export function curationToShortlistState(curation: AccommodationCuration): { shortlist: ShortlistEntry[]; notes: string } {
  const shortlist: ShortlistEntry[] = curation.properties.map((property) => {
    const entry = toShortlistEntry(curatedPropertyToCanonical(property));
    const isRecommended = curation.recommendedPropertyId === property.propertyId;
    return {
      ...entry,
      advantages: property.advantages ?? "",
      disadvantages: property.disadvantages ?? "",
      isRecommended,
      recommendationReason: isRecommended ? curation.recommendationReason ?? "" : "",
    };
  });
  return { shortlist, notes: curation.notes ?? "" };
}
