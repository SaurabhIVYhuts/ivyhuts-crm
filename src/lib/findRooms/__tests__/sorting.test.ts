import { describe, expect, it } from "vitest";
import { filterPropertiesByProvider, sortProperties } from "../sorting";
import type { CanonicalProperty } from "@/lib/property-intelligence";

function makeProperty(overrides: Partial<CanonicalProperty>): CanonicalProperty {
  return {
    provider: "uhomes",
    providerPropertyId: "id-1",
    propertyId: "uhomes:id:id-1",
    name: "Test Property",
    url: null,
    slug: null,
    image: null,
    images: [],
    city: null,
    country: null,
    latitude: null,
    longitude: null,
    rent: null,
    currency: null,
    rentPeriod: "unknown",
    rentPerWeek: null,
    roomType: null,
    sharing: null,
    availability: "unknown",
    amenities: [],
    sourceUpdatedAt: null,
    distanceFromUniversityKm: null,
    providerMeta: null,
    ...overrides,
  };
}

describe("sortProperties", () => {
  it("sorts by price ascending, unknown price last", () => {
    const a = makeProperty({ propertyId: "a", rentPerWeek: 250 });
    const b = makeProperty({ propertyId: "b", rentPerWeek: 150 });
    const c = makeProperty({ propertyId: "c", rentPerWeek: null });
    const sorted = sortProperties([a, b, c], "price");
    expect(sorted.map((p) => p.propertyId)).toEqual(["b", "a", "c"]);
  });

  it("sorts by distance ascending, unknown distance last", () => {
    const a = makeProperty({ propertyId: "a", distanceFromUniversityKm: 2.5 });
    const b = makeProperty({ propertyId: "b", distanceFromUniversityKm: 0.8 });
    const c = makeProperty({ propertyId: "c", distanceFromUniversityKm: null });
    const sorted = sortProperties([a, b, c], "distance");
    expect(sorted.map((p) => p.propertyId)).toEqual(["b", "a", "c"]);
  });

  it("'recommended' puts available properties before unavailable ones, regardless of price/distance", () => {
    const cheaperButUnavailable = makeProperty({ propertyId: "a", availability: "unavailable", rentPerWeek: 100 });
    const pricierButAvailable = makeProperty({ propertyId: "b", availability: "available", rentPerWeek: 300 });
    const sorted = sortProperties([cheaperButUnavailable, pricierButAvailable], "recommended");
    expect(sorted.map((p) => p.propertyId)).toEqual(["b", "a"]);
  });

  it("'recommended' breaks ties by distance, then by price", () => {
    const a = makeProperty({ propertyId: "a", availability: "available", distanceFromUniversityKm: 1, rentPerWeek: 300 });
    const b = makeProperty({ propertyId: "b", availability: "available", distanceFromUniversityKm: 0.5, rentPerWeek: 400 });
    const c = makeProperty({ propertyId: "c", availability: "available", distanceFromUniversityKm: 0.5, rentPerWeek: 200 });
    const sorted = sortProperties([a, b, c], "recommended");
    expect(sorted.map((p) => p.propertyId)).toEqual(["c", "b", "a"]);
  });

  it("does not mutate the input array", () => {
    const a = makeProperty({ propertyId: "a", rentPerWeek: 250 });
    const b = makeProperty({ propertyId: "b", rentPerWeek: 150 });
    const input = [a, b];
    sortProperties(input, "price");
    expect(input).toEqual([a, b]);
  });
});

describe("filterPropertiesByProvider", () => {
  const uhomes = makeProperty({ propertyId: "a", provider: "uhomes" });
  const uniacco = makeProperty({ propertyId: "b", provider: "uniacco" });

  it("returns everything for 'all'", () => {
    expect(filterPropertiesByProvider([uhomes, uniacco], "all")).toEqual([uhomes, uniacco]);
  });

  it("filters down to a single provider", () => {
    expect(filterPropertiesByProvider([uhomes, uniacco], "uhomes")).toEqual([uhomes]);
  });
});
