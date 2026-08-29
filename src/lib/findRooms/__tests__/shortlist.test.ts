import { describe, expect, it } from "vitest";
import { shortlistReducer, toShortlistEntry, type ShortlistEntry } from "../shortlist";
import type { CanonicalProperty } from "@/lib/property-intelligence";

function makeProperty(overrides: Partial<CanonicalProperty>): CanonicalProperty {
  return {
    provider: "uhomes",
    providerPropertyId: "id-1",
    propertyId: "uhomes:id:id-1",
    name: "Luna Hatfield",
    url: "https://uhomes.com/p/1",
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

describe("toShortlistEntry", () => {
  it("preserves canonical identity and starts un-recommended with empty notes", () => {
    const property = makeProperty({});
    const entry = toShortlistEntry(property);
    expect(entry.provider).toBe("uhomes");
    expect(entry.providerPropertyId).toBe("id-1");
    expect(entry.propertyId).toBe("uhomes:id:id-1");
    expect(entry.isRecommended).toBe(false);
    expect(entry.recommendationReason).toBe("");
    expect(entry.advantages).toBe("");
    expect(entry.disadvantages).toBe("");
  });
});

describe("shortlistReducer", () => {
  const propertyA = makeProperty({ propertyId: "a", name: "Property A" });
  const propertyB = makeProperty({ propertyId: "b", name: "Property B" });
  const propertyC = makeProperty({ propertyId: "c", name: "Property C" });

  it("supports adding multiple distinct properties", () => {
    let state: ShortlistEntry[] = [];
    state = shortlistReducer(state, { type: "add", property: propertyA });
    state = shortlistReducer(state, { type: "add", property: propertyB });
    state = shortlistReducer(state, { type: "add", property: propertyC });
    expect(state.map((e) => e.propertyId)).toEqual(["a", "b", "c"]);
  });

  it("never adds automatically — only in response to an explicit add action, and never adds a duplicate", () => {
    let state: ShortlistEntry[] = [];
    state = shortlistReducer(state, { type: "add", property: propertyA });
    state = shortlistReducer(state, { type: "add", property: propertyA });
    expect(state).toHaveLength(1);
  });

  it("removes a property from the shortlist", () => {
    let state: ShortlistEntry[] = [];
    state = shortlistReducer(state, { type: "add", property: propertyA });
    state = shortlistReducer(state, { type: "add", property: propertyB });
    state = shortlistReducer(state, { type: "remove", propertyId: "a" });
    expect(state.map((e) => e.propertyId)).toEqual(["b"]);
  });

  it("allows at most one recommended property — marking a new one clears the previous", () => {
    let state: ShortlistEntry[] = [];
    state = shortlistReducer(state, { type: "add", property: propertyA });
    state = shortlistReducer(state, { type: "add", property: propertyB });
    state = shortlistReducer(state, { type: "markRecommended", propertyId: "a" });
    expect(state.filter((e) => e.isRecommended).map((e) => e.propertyId)).toEqual(["a"]);

    state = shortlistReducer(state, { type: "markRecommended", propertyId: "b" });
    const recommended = state.filter((e) => e.isRecommended);
    expect(recommended).toHaveLength(1);
    expect(recommended[0].propertyId).toBe("b");
  });

  it("unmarkRecommended clears recommendation without affecting other entries", () => {
    let state: ShortlistEntry[] = [];
    state = shortlistReducer(state, { type: "add", property: propertyA });
    state = shortlistReducer(state, { type: "markRecommended", propertyId: "a" });
    state = shortlistReducer(state, { type: "unmarkRecommended", propertyId: "a" });
    expect(state.every((e) => !e.isRecommended)).toBe(true);
  });

  it("stores recommendation reason, advantages, and disadvantages independently per property", () => {
    let state: ShortlistEntry[] = [];
    state = shortlistReducer(state, { type: "add", property: propertyA });
    state = shortlistReducer(state, {
      type: "updateNotes",
      propertyId: "a",
      patch: { recommendationReason: "Closest to campus", advantages: "Cheap", disadvantages: "No lift" },
    });
    const entry = state.find((e) => e.propertyId === "a")!;
    expect(entry.recommendationReason).toBe("Closest to campus");
    expect(entry.advantages).toBe("Cheap");
    expect(entry.disadvantages).toBe("No lift");
  });

  it("removing the recommended property simply removes it — no other entry becomes auto-recommended", () => {
    let state: ShortlistEntry[] = [];
    state = shortlistReducer(state, { type: "add", property: propertyA });
    state = shortlistReducer(state, { type: "add", property: propertyB });
    state = shortlistReducer(state, { type: "markRecommended", propertyId: "a" });
    state = shortlistReducer(state, { type: "remove", propertyId: "a" });
    expect(state.some((e) => e.isRecommended)).toBe(false);
  });
});
