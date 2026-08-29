// Derives Find Rooms' three mandatory requirements (university, budget,
// sharing) from a lead's Discovery record. Pure, no I/O — the honest
// "Complete Discovery to find rooms" gate (RequirementsGate.tsx) and the
// search-criteria builder both use this same derivation, so they can never
// disagree about what's missing.
//
// Milestone 23.7 — Discovery now has a real, canonical numeric
// `accommodation.sharing` field (see src/types/discovery.ts), which this
// function prefers whenever it's set. For records saved before that
// milestone (or where the agent simply hasn't filled it in), it falls back
// to deriving a value from the free-text `roomPreference` via the same
// normalizeSharing() the provider-normalization layer uses for the
// identical problem — never guessing when the text isn't confidently
// parseable. `sharingSource` tells the UI which happened, so a derived
// value can be shown as "please confirm" rather than presented as
// deliberately entered.
import { normalizeSharing } from "@/lib/property-intelligence";
import type { Discovery } from "@/types/discovery";

export type RequirementField = "university" | "budget" | "sharing";

export const REQUIREMENT_LABELS: Record<RequirementField, string> = {
  university: "University",
  budget: "Budget",
  sharing: "Sharing",
};

export type SharingSource = "explicit" | "derived" | null;

export interface FindRoomsRequirements {
  university: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string | null;
  sharing: number | null;
  // "explicit": agent entered accommodation.sharing directly.
  // "derived": no explicit value; recovered from roomPreference text.
  // null: sharing itself is null (missing) — nothing to attribute a source to.
  sharingSource: SharingSource;
  missing: RequirementField[];
  isComplete: boolean;
}

export function deriveFindRoomsRequirements(discovery: Discovery | null): FindRoomsRequirements {
  const university = discovery?.student.university?.trim() || null;
  const budgetMin = discovery?.accommodation.budgetMin ?? null;
  const budgetMax = discovery?.accommodation.budgetMax ?? null;
  const currency = discovery?.accommodation.currency ?? null;

  // A stray non-positive value (backend validation already rejects <= 0 at
  // write time — this only guards defensively against pre-validation
  // legacy data) is treated as absent, not as a real explicit answer.
  const rawSharing = discovery?.accommodation.sharing ?? null;
  const explicitSharing = rawSharing != null && rawSharing > 0 ? rawSharing : null;
  const derivedSharing = explicitSharing == null ? normalizeSharing(discovery?.accommodation.roomPreference ?? null) : null;
  const sharing = explicitSharing ?? derivedSharing;
  const sharingSource: SharingSource = explicitSharing != null ? "explicit" : derivedSharing != null ? "derived" : null;

  const missing: RequirementField[] = [];
  if (!university) missing.push("university");
  if (budgetMin == null && budgetMax == null) missing.push("budget");
  if (sharing == null) missing.push("sharing");

  return { university, budgetMin, budgetMax, currency, sharing, sharingSource, missing, isComplete: missing.length === 0 };
}
