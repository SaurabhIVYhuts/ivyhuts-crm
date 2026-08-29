import { describe, expect, it } from "vitest";
import {
  criteriaSnapshotToStalenessSnapshot,
  criteriaToSnapshot,
  curationInputsEqual,
  curationToShortlistState,
  shortlistToCurationInput,
} from "../curationSync";
import { shortlistReducer, type ShortlistEntry } from "../shortlist";
import type { CanonicalProperty } from "@/lib/property-intelligence";
import type { AccommodationCuration } from "@/types/accommodationCuration";
import type { FindRoomsSearchCriteria } from "@/types/property";

function makeProperty(overrides: Partial<CanonicalProperty> = {}): CanonicalProperty {
  return {
    provider: "uhomes",
    providerPropertyId: "abc123",
    propertyId: "uhomes:id:abc123",
    name: "Luna Hatfield",
    url: "https://uhomes.com/p/abc123",
    slug: null,
    image: null,
    images: [],
    city: "Hatfield",
    country: "United Kingdom",
    latitude: null,
    longitude: null,
    rent: 190,
    currency: "GBP",
    rentPeriod: "week",
    rentPerWeek: 190,
    roomType: "Ensuite",
    sharing: 2,
    availability: "available",
    amenities: ["wifi"],
    sourceUpdatedAt: null,
    distanceFromUniversityKm: 0.8,
    providerMeta: null,
    ...overrides,
  };
}

const fullCriteria: FindRoomsSearchCriteria = {
  university: { id: "university-of-hertfordshire", name: "University of Hertfordshire", city: "Hatfield", country: "United Kingdom", latitude: 51.7636, longitude: -0.2405 },
  budgetMin: 150,
  budgetMax: 250,
  sharing: 2,
  amenities: [],
};

describe("criteriaToSnapshot", () => {
  it("carries every field through to the persisted CriteriaSnapshot shape", () => {
    const snapshot = criteriaToSnapshot(fullCriteria);
    expect(snapshot).toEqual({
      university: fullCriteria.university,
      budgetMin: 150,
      budgetMax: 250,
      currency: null,
      sharing: 2,
      roomType: null,
      moveInDate: null,
      stayDurationMonths: null,
      preferredDistance: null,
      amenities: [],
    });
  });
});

describe("criteriaSnapshotToStalenessSnapshot", () => {
  it("null in, null out", () => {
    expect(criteriaSnapshotToStalenessSnapshot(null)).toBeNull();
  });
  it("narrows university to its name only", () => {
    const snapshot = criteriaToSnapshot(fullCriteria);
    const narrowed = criteriaSnapshotToStalenessSnapshot(snapshot);
    expect(narrowed).toEqual({ university: "University of Hertfordshire", budgetMin: 150, budgetMax: 250, currency: null, sharing: 2 });
  });

  it("Milestone 23.17 — carries currency through, not just university/budget/sharing", () => {
    const snapshot = criteriaToSnapshot({ ...fullCriteria, currency: "GBP" });
    expect(criteriaSnapshotToStalenessSnapshot(snapshot)?.currency).toBe("GBP");
  });
});

describe("shortlistToCurationInput", () => {
  it("empty shortlist saves cleanly with no recommendation", () => {
    const input = shortlistToCurationInput([], null, "");
    expect(input).toEqual({ criteriaSnapshot: null, properties: [], recommendedPropertyId: null, recommendationReason: null, notes: null });
  });

  it("takes the recommendation from whichever entry is marked recommended", () => {
    let state: ShortlistEntry[] = [];
    state = shortlistReducer(state, { type: "add", property: makeProperty({ propertyId: "a" }) });
    state = shortlistReducer(state, { type: "add", property: makeProperty({ propertyId: "b", providerPropertyId: "b" }) });
    state = shortlistReducer(state, { type: "markRecommended", propertyId: "b" });
    state = shortlistReducer(state, { type: "updateNotes", propertyId: "b", patch: { recommendationReason: "Closest to campus" } });

    const input = shortlistToCurationInput(state, null, "Agent note");
    expect(input.recommendedPropertyId).toBe("b");
    expect(input.recommendationReason).toBe("Closest to campus");
    expect(input.properties).toHaveLength(2);
    expect(input.notes).toBe("Agent note");
  });

  it("no recommendation -> null recommendedPropertyId/reason, never a guess", () => {
    let state: ShortlistEntry[] = [];
    state = shortlistReducer(state, { type: "add", property: makeProperty({}) });
    const input = shortlistToCurationInput(state, null, "");
    expect(input.recommendedPropertyId).toBeNull();
    expect(input.recommendationReason).toBeNull();
    expect(input.notes).toBeNull();
  });

  it("preserves per-property advantages/disadvantages", () => {
    let state: ShortlistEntry[] = [];
    state = shortlistReducer(state, { type: "add", property: makeProperty({}) });
    state = shortlistReducer(state, { type: "updateNotes", propertyId: "uhomes:id:abc123", patch: { advantages: "Cheap", disadvantages: "No lift" } });
    const input = shortlistToCurationInput(state, null, "");
    expect(input.properties[0].advantages).toBe("Cheap");
    expect(input.properties[0].disadvantages).toBe("No lift");
  });
});

function makeCuration(overrides: Partial<AccommodationCuration> = {}): AccommodationCuration {
  return {
    id: "curation1",
    leadId: "lead1",
    criteriaSnapshot: criteriaToSnapshot(fullCriteria),
    properties: [],
    recommendedPropertyId: null,
    recommendationReason: null,
    notes: null,
    createdBy: "user1",
    updatedBy: "user1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("curationToShortlistState", () => {
  it("hydrates an empty saved curation into an empty shortlist", () => {
    const { shortlist, notes } = curationToShortlistState(makeCuration({}));
    expect(shortlist).toEqual([]);
    expect(notes).toBe("");
  });

  it("restores the recommendation onto the matching property only", () => {
    const property = shortlistToCurationInput(
      shortlistReducer([], { type: "add", property: makeProperty({}) }),
      null,
      ""
    ).properties[0];
    const curation = makeCuration({
      properties: [property, { ...property, propertyId: "uhomes:id:other", providerPropertyId: "other" }],
      recommendedPropertyId: "uhomes:id:abc123",
      recommendationReason: "Best value",
      notes: "Student prefers ground floor.",
    });

    const { shortlist, notes } = curationToShortlistState(curation);
    expect(notes).toBe("Student prefers ground floor.");
    const recommended = shortlist.find((e) => e.propertyId === "uhomes:id:abc123")!;
    const other = shortlist.find((e) => e.propertyId === "uhomes:id:other")!;
    expect(recommended.isRecommended).toBe(true);
    expect(recommended.recommendationReason).toBe("Best value");
    expect(other.isRecommended).toBe(false);
    expect(other.recommendationReason).toBe("");
  });

  it("round-trips through shortlistToCurationInput -> curationToShortlistState without losing identity", () => {
    let state: ShortlistEntry[] = [];
    state = shortlistReducer(state, { type: "add", property: makeProperty({}) });
    state = shortlistReducer(state, { type: "markRecommended", propertyId: "uhomes:id:abc123" });
    state = shortlistReducer(state, { type: "updateNotes", propertyId: "uhomes:id:abc123", patch: { recommendationReason: "Great location" } });

    const input = shortlistToCurationInput(state, criteriaToSnapshot(fullCriteria), "note");
    const curation = makeCuration({ properties: input.properties, recommendedPropertyId: input.recommendedPropertyId, recommendationReason: input.recommendationReason, notes: input.notes });
    const { shortlist } = curationToShortlistState(curation);

    expect(shortlist[0].propertyId).toBe("uhomes:id:abc123");
    expect(shortlist[0].isRecommended).toBe(true);
    expect(shortlist[0].recommendationReason).toBe("Great location");
    expect(shortlist[0].provider).toBe("uhomes");
    expect(shortlist[0].providerPropertyId).toBe("abc123");
  });
});

describe("curationInputsEqual", () => {
  it("is true for identical payloads", () => {
    const input = shortlistToCurationInput([], criteriaToSnapshot(fullCriteria), "note");
    expect(curationInputsEqual(input, { ...input })).toBe(true);
  });

  it("is false when notes differ", () => {
    const base = shortlistToCurationInput([], null, "note a");
    const changed = shortlistToCurationInput([], null, "note b");
    expect(curationInputsEqual(base, changed)).toBe(false);
  });

  it("is false when the shortlist itself differs", () => {
    const empty = shortlistToCurationInput([], null, "");
    const withOne = shortlistToCurationInput(shortlistReducer([], { type: "add", property: makeProperty({}) }), null, "");
    expect(curationInputsEqual(empty, withOne)).toBe(false);
  });
});
