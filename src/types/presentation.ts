// Mirrors api/_lib/models/Presentation.js and its toSafePresentation
// projection in the ivyhuts-website backend (Milestone 23.8, extended
// 23.21). Field set verified against api/leads/[id]/presentations/index.js,
// .../[presentationId]/index.js and .../[presentationId]/download.js.
// `snapshot` itself (the FULL immutable per-version property/criteria copy
// — see the model's header comment) stays an internal implementation
// detail the CRM never renders in full. `properties` below (Milestone
// 23.21) is a deliberately narrow projection of snapshot.properties —
// enough for the CRM to show "what was in this version" without opening
// the .pptx — never a live AccommodationCuration lookup, so it stays
// historically accurate even after the live curation changes.
//
// generatedFrom points at the lead's AccommodationCuration
// (src/types/accommodationCuration.ts) for the property source of truth —
// NEVER CompetitiveAnalysis (confirmed backend-absent; see
// PresentationsSection.tsx's own header comment for why the earlier
// Discovery+CompetitiveAnalysis gate was replaced with a curation-only
// one). Milestone 23.18 additionally reads confirmed Discovery (read-only)
// to personalize the deck's client-requirements content, so generatedFrom
// now also records which Discovery record/version that was — properties
// still come exclusively from AccommodationCuration.

export const PRESENTATION_STATUSES = ["GENERATING", "READY", "FAILED"] as const;
export type PresentationStatus = (typeof PRESENTATION_STATUSES)[number];

export interface PresentationFile {
  filename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
}

export interface PresentationProvenance {
  accommodationCurationId: string | null;
  accommodationCurationUpdatedAt: string | null;
  discoveryId: string | null;
  discoveryUpdatedAt: string | null;
}

// Milestone 23.21 — one property AS IT WAS STORED in this specific
// version's own immutable snapshot at generation time (never a live
// AccommodationCuration.CuratedProperty lookup). propertyId is the
// canonical identity carried through from curation/search (see
// src/types/accommodationCuration.ts) — never an array index. Deliberately
// narrower than CuratedProperty (no availability/distance/amenities/
// advantages here) — a compact per-version summary, not a second full
// property view; the real .pptx still has the complete picture.
export interface PresentationProperty {
  propertyId: string;
  name: string;
  provider: string;
  roomType: string | null;
  rent: number | null;
  currency: string | null;
  rentPeriod: string;
  city: string | null;
  country: string | null;
}

export interface Presentation {
  id: string;
  leadId: string;
  version: number;
  title: string;
  status: PresentationStatus;
  errorMessage: string | null;
  file: PresentationFile;
  properties: PresentationProperty[];
  generatedFrom: PresentationProvenance;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}
