// Mirrors api/_lib/models/Discovery.js and its toSafeDiscovery projection
// in the ivyhuts-website backend. Field set verified against
// api/leads/[id]/discovery.js (GET/PUT) — do not add fields here that
// aren't handled by that route. This is now a REAL, working backend
// contract (Milestone 23.7) — previously (through Milestone 23.6) this
// file described a route that didn't exist yet.

export const DISCOVERY_PRIORITY_FACTORS = [
  "budget",
  "distance",
  "travel_convenience",
  "amenities",
  "location",
  "property_quality",
  "other",
] as const;

export type DiscoveryPriorityFactor = (typeof DISCOVERY_PRIORITY_FACTORS)[number];

// Resolved university SNAPSHOT — populated only when `university` (free
// text, below) was successfully resolved via GET /api/universities/resolve
// (src/lib/api/universities.ts), which itself always defers to the
// backend's one authoritative dataset (api/_lib/campusUniversities.json).
// Never a second university database — just a per-Discovery cached result
// of resolving against it. `university` remains authoritative for what was
// actually typed/heard; this is enrichment and may be null even when
// `university` is set (unresolved).
export interface DiscoveryUniversitySnapshot {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface DiscoveryStudent {
  university: string | null;
  universityResolved: DiscoveryUniversitySnapshot | null;
  course: string | null;
  intake: string | null;
}

export interface DiscoveryAccommodation {
  budgetMin: number | null;
  budgetMax: number | null;
  // Required (validated backend-side) whenever budgetMin/budgetMax is set
  // — never assume a currency (e.g. GBP) when it's absent.
  currency: string | null;
  moveInDate: string | null;
  stayDurationMonths: number | null;
  preferredLocation: string | null;
  roomPreference: string | null;
  // Number of people sharing the room/unit (1 = private/single). Distinct
  // from roomPreference, which is a free-text room-TYPE descriptor
  // ("ensuite", "studio", "shared bathroom") — never a people-count.
  // Nullable and never guessed at write time; see
  // src/lib/findRooms/requirements.ts for how a legacy record with only
  // roomPreference (no explicit sharing) is honestly handled at read time.
  sharing: number | null;
  distancePreference: string | null;
}

// Milestone 23.10 — where each of the three core requirements actually
// came from. Provenance on the CONFIRMED value only: there is no separate
// "suggested" value anywhere in this contract, because nothing in this
// codebase extracts requirements automatically (no AI transcription
// exists — see src/types/meeting.ts's own header comment). A meeting with
// an available transcript is instead surfaced as a prompt for the agent to
// come back and set these fields themselves.
export const REQUIREMENT_SOURCES = ["lead_form", "agent", "meeting", "transcript"] as const;
export type RequirementSource = (typeof REQUIREMENT_SOURCES)[number];

export interface RequirementSources {
  university: RequirementSource | null;
  budget: RequirementSource | null;
  sharing: RequirementSource | null;
}

export interface Discovery {
  id: string;
  leadId: string;
  student: DiscoveryStudent;
  accommodation: DiscoveryAccommodation;
  priorities: DiscoveryPriorityFactor[];
  notes: string | null;
  requirementSources: RequirementSources;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// Body for PUT /api/leads/:id/discovery. Every field is optional and
// partial — a key omitted here is left untouched server-side; an explicit
// `null` clears it. Lets the agent save incrementally across calls.
export interface DiscoveryInput {
  student?: Partial<DiscoveryStudent>;
  accommodation?: Partial<DiscoveryAccommodation>;
  priorities?: DiscoveryPriorityFactor[];
  notes?: string | null;
  requirementSources?: Partial<RequirementSources>;
}
