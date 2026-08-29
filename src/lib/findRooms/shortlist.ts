// Curated shortlist state — CLIENT-SIDE ONLY, not persisted anywhere.
// See FindRoomsSection.tsx's header comment and the Milestone 23.5 report
// for why: no backend model/route exists yet for a Find Rooms shortlist
// (verified directly against the backend repo before writing this — see
// that report's Part 17). State here is lost on page refresh/navigation
// until a real persistence contract is built.
//
// Preserves canonical property IDENTITY (provider, providerPropertyId,
// propertyId) rather than a raw provider payload — matches the Milestone
// 23.1 CanonicalProperty identity rule, ready to be persisted unchanged
// once a backend contract exists (see Milestone 23.5 report Part on
// persistence for the proposed shape).
import type { CanonicalProperty } from "@/lib/property-intelligence";

export interface ShortlistEntry {
  provider: CanonicalProperty["provider"];
  providerPropertyId: string | null;
  propertyId: string;
  name: string;
  url: string | null;
  image: string | null;
  city: string | null;
  rent: number | null;
  currency: string | null;
  rentPeriod: CanonicalProperty["rentPeriod"];
  rentPerWeek: number | null;
  roomType: string | null;
  sharing: number | null;
  distanceFromUniversityKm: number | null;
  isRecommended: boolean;
  recommendationReason: string;
  advantages: string;
  disadvantages: string;
}

export function toShortlistEntry(property: CanonicalProperty): ShortlistEntry {
  return {
    provider: property.provider,
    providerPropertyId: property.providerPropertyId,
    propertyId: property.propertyId,
    name: property.name,
    url: property.url,
    image: property.image,
    city: property.city,
    rent: property.rent,
    currency: property.currency,
    rentPeriod: property.rentPeriod,
    rentPerWeek: property.rentPerWeek,
    roomType: property.roomType,
    sharing: property.sharing,
    distanceFromUniversityKm: property.distanceFromUniversityKm,
    isRecommended: false,
    recommendationReason: "",
    advantages: "",
    disadvantages: "",
  };
}

export type ShortlistAction =
  | { type: "add"; property: CanonicalProperty }
  | { type: "remove"; propertyId: string }
  | { type: "markRecommended"; propertyId: string }
  | { type: "unmarkRecommended"; propertyId: string }
  | {
      type: "updateNotes";
      propertyId: string;
      patch: Partial<Pick<ShortlistEntry, "recommendationReason" | "advantages" | "disadvantages">>;
    }
  // Hydrates the reducer from a persisted curation on load (Milestone
  // 23.6) — the only action that replaces the whole list wholesale rather
  // than transforming it, since useReducer's initial state is fixed at
  // first render and the persisted shortlist only becomes known after an
  // async GET.
  | { type: "replaceAll"; entries: ShortlistEntry[] };

// At most one recommended property at a time (Milestone 23.5 Part 16) —
// markRecommended always clears any previously-recommended entry, and
// nothing here ever picks a recommendation automatically; every
// transition is a direct, explicit agent action dispatched from the UI.
export function shortlistReducer(state: ShortlistEntry[], action: ShortlistAction): ShortlistEntry[] {
  switch (action.type) {
    case "add":
      if (state.some((e) => e.propertyId === action.property.propertyId)) return state;
      return [...state, toShortlistEntry(action.property)];
    case "remove":
      return state.filter((e) => e.propertyId !== action.propertyId);
    case "markRecommended":
      return state.map((e) => ({ ...e, isRecommended: e.propertyId === action.propertyId }));
    case "unmarkRecommended":
      return state.map((e) => (e.propertyId === action.propertyId ? { ...e, isRecommended: false } : e));
    case "updateNotes":
      return state.map((e) => (e.propertyId === action.propertyId ? { ...e, ...action.patch } : e));
    case "replaceAll":
      return action.entries;
    default:
      return state;
  }
}
