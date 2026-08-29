// Deterministic result sorting — no AI, no invented score. See
// RECOMMENDED_EXPLANATION below, which the UI surfaces next to the sort
// control so "Recommended" is never an unexplained black box (Milestone
// 23.5 Part 13).
import type { CanonicalProperty, PropertyProvider } from "@/lib/property-intelligence";

// Client-side filtering of already-returned results only (Milestone 23.5
// Part 12) — never triggers another /api/properties/search request.
export function filterPropertiesByProvider(
  properties: CanonicalProperty[],
  provider: PropertyProvider | "all"
): CanonicalProperty[] {
  if (provider === "all") return properties;
  return properties.filter((p) => p.provider === provider);
}

export const SORT_OPTIONS = ["recommended", "price", "distance"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const SORT_LABELS: Record<SortOption, string> = {
  recommended: "Recommended",
  price: "Lowest price",
  distance: "Closest",
};

export const RECOMMENDED_EXPLANATION =
  "Available properties first, then lower distance from university, then lower weekly cost.";

// A null value always sorts after a real one, for either comparand —
// "unknown" is never treated as better OR worse than a known value beyond
// simply yielding to it.
function compareNullsLast(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

export function sortProperties(properties: CanonicalProperty[], sortBy: SortOption): CanonicalProperty[] {
  const sorted = [...properties];

  if (sortBy === "price") {
    sorted.sort((a, b) => compareNullsLast(a.rentPerWeek, b.rentPerWeek));
    return sorted;
  }

  if (sortBy === "distance") {
    sorted.sort((a, b) => compareNullsLast(a.distanceFromUniversityKm, b.distanceFromUniversityKm));
    return sorted;
  }

  // recommended: available-first, then closer, then cheaper — see
  // RECOMMENDED_EXPLANATION.
  sorted.sort((a, b) => {
    const unavailableScore = (p: CanonicalProperty) => (p.availability === "unavailable" ? 1 : 0);
    const availabilityDiff = unavailableScore(a) - unavailableScore(b);
    if (availabilityDiff !== 0) return availabilityDiff;

    const distanceDiff = compareNullsLast(a.distanceFromUniversityKm, b.distanceFromUniversityKm);
    if (distanceDiff !== 0) return distanceDiff;

    return compareNullsLast(a.rentPerWeek, b.rentPerWeek);
  });
  return sorted;
}
