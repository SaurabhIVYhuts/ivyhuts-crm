// Display formatting for CanonicalProperty fields. Every function here
// returns "Not provided" for a missing value — never "0", never a
// fabricated placeholder (Milestone 23.5 Part 10).
import type { CanonicalProperty, PropertyAvailability, RentPeriod } from "@/lib/property-intelligence";
import type { SearchedCriteriaSnapshot } from "./staleness";

const NOT_PROVIDED = "Not provided";

export function formatRent(rent: number | null, currency: string | null, rentPeriod: RentPeriod): string {
  if (rent == null) return NOT_PROVIDED;
  const amount = currency ? `${currency} ${rent}` : String(rent);
  if (rentPeriod === "week") return `${amount} / week`;
  if (rentPeriod === "month") return `${amount} / month`;
  if (rentPeriod === "night") return `${amount} / night`;
  return amount;
}

export function formatSharing(sharing: number | null): string {
  if (sharing == null) return NOT_PROVIDED;
  return sharing === 1 ? "Private / single" : `${sharing} sharing`;
}

// Backend-provided distanceFromUniversityKm only — this function never
// computes a distance itself (Milestone 23.5 Part 11), only formats one
// that's already been calculated server-side.
export function formatDistanceKm(distanceKm: number | null): string {
  if (distanceKm == null) return NOT_PROVIDED;
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m from university`;
  return `${distanceKm.toFixed(1)} km from university`;
}

export function formatAvailability(availability: PropertyAvailability): string {
  if (availability === "available") return "Available";
  if (availability === "unavailable") return "Unavailable";
  return NOT_PROVIDED;
}

export function formatCity(city: string | null): string {
  return city ?? NOT_PROVIDED;
}

export function formatRoomType(roomType: string | null): string {
  return roomType ?? NOT_PROVIDED;
}

export function propertyCardKey(property: CanonicalProperty): string {
  return property.propertyId;
}

// One-line human summary of a criteria snapshot — used by the "Requirements
// changed" staleness banners (both the search-results one from Milestone
// 23.5 and the saved-shortlist one from Milestone 23.6) to show exactly
// what changed. Milestone 23.17 — includes currency (same
// CriteriaPanel.tsx's own formatBudgetRange convention: shown when known,
// omitted rather than assumed when not) so a currency-only change actually
// reads as a visible difference between the "saved for" / "current" lines,
// not two summaries that look identical while the underlying budget means
// something entirely different.
export function formatCriteriaSummary(snapshot: SearchedCriteriaSnapshot | null): string {
  if (!snapshot) return NOT_PROVIDED;
  const c = snapshot.currency ? `${snapshot.currency} ` : "";
  const budget =
    snapshot.budgetMin != null && snapshot.budgetMax != null
      ? `${c}${snapshot.budgetMin}–${snapshot.budgetMax}/week`
      : snapshot.budgetMin != null
        ? `${c}${snapshot.budgetMin}+/week`
        : snapshot.budgetMax != null
          ? `Up to ${c}${snapshot.budgetMax}/week`
          : "budget not set";
  const sharing = snapshot.sharing != null ? formatSharing(snapshot.sharing) : "sharing not set";
  return `${snapshot.university ?? "university not set"} · ${budget} · ${sharing}`;
}
