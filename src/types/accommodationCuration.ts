// Mirrors api/leads/[id]/accommodation-curation.js's GET/PUT response and
// PUT request body on the IVYHUTS backend (Milestone 23.6). Contract
// verified directly against that source — do not add fields here that
// aren't handled by that route.
//
// This is a distinct concept from src/types/competitiveAnalysis.ts's
// CompetitiveAnalysis (whose backend route was confirmed absent —
// Milestone 23.2/23.6) — see AccommodationCuration.js's own header comment
// for why this reuses that type's proven SHAPE (top-level
// recommendedPropertyId/recommendationReason, per-property
// advantages/disadvantages) without pretending the old contract is real.
import type { FindRoomsUniversityInput, PropertySource } from "./property";
import type { PropertyAvailability, RentPeriod } from "@/lib/property-intelligence";

export interface CriteriaSnapshot {
  university: FindRoomsUniversityInput;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string | null;
  sharing: number;
  roomType: string | null;
  moveInDate: string | null;
  stayDurationMonths: number | null;
  preferredDistance: number | null;
  amenities: string[];
}

export interface CuratedProperty {
  provider: PropertySource;
  providerPropertyId: string | null;
  propertyId: string;
  name: string;
  url: string | null;
  slug: string | null;
  image: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  rent: number | null;
  rentPerWeek: number | null;
  currency: string | null;
  rentPeriod: RentPeriod;
  roomType: string | null;
  sharing: number | null;
  availability: PropertyAvailability;
  amenities: string[];
  distanceFromUniversityKm: number | null;
  // Curated, agent-written — never a raw provider field.
  advantages: string | null;
  disadvantages: string | null;
  providerMeta: Record<string, unknown> | null;
}

export interface AccommodationCuration {
  id: string;
  leadId: string;
  criteriaSnapshot: CriteriaSnapshot | null;
  properties: CuratedProperty[];
  recommendedPropertyId: string | null;
  recommendationReason: string | null;
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// Body for PUT /api/leads/:id/accommodation-curation — a full replace, same
// "client always sends the complete current state" convention as
// CompetitiveAnalysisInput. createdBy/updatedBy are never part of this
// type — identity always comes from the session server-side.
export interface AccommodationCurationInput {
  criteriaSnapshot: CriteriaSnapshot | null;
  properties: CuratedProperty[];
  recommendedPropertyId: string | null;
  recommendationReason: string | null;
  notes: string | null;
}
