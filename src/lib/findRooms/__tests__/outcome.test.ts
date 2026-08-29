import { describe, expect, it } from "vitest";
import { describeSearchOutcome } from "../outcome";
import type { FindRoomsSearchResult } from "@/types/property";
import type { CanonicalProperty } from "@/lib/property-intelligence";

function makeProperty(propertyId: string): CanonicalProperty {
  return {
    provider: "uhomes",
    providerPropertyId: propertyId,
    propertyId: `uhomes:id:${propertyId}`,
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
  };
}

function makeResult(overrides: Partial<FindRoomsSearchResult>): FindRoomsSearchResult {
  return {
    properties: [],
    providerCoverage: [
      { provider: "uhomes", status: "NOT_CONFIGURED", count: 0, reason: "not configured" },
      { provider: "uniacco", status: "NOT_CONFIGURED", count: 0, reason: "not configured" },
      { provider: "university_living", status: "NOT_CONFIGURED", count: 0, reason: "not configured" },
      { provider: "gradding_homes", status: "NOT_CONFIGURED", count: 0, reason: "not configured" },
    ],
    searchMetadata: {
      searchedAt: "2026-01-01T00:00:00.000Z",
      university: { name: "Test University" },
      criteria: { sharing: 2 },
      disclaimer: "Matching properties from connected sources.",
    },
    ...overrides,
  };
}

describe("describeSearchOutcome", () => {
  it("reports no_providers_configured when all four providers are NOT_CONFIGURED", () => {
    const outcome = describeSearchOutcome(makeResult({}));
    expect(outcome).toEqual({ kind: "no_providers_configured" });
  });

  it("reports no_matches when at least one provider was searched but zero properties came back", () => {
    const outcome = describeSearchOutcome(
      makeResult({
        providerCoverage: [
          { provider: "uhomes", status: "SEARCHED", count: 0 },
          { provider: "uniacco", status: "NOT_CONFIGURED", count: 0 },
          { provider: "university_living", status: "NOT_CONFIGURED", count: 0 },
          { provider: "gradding_homes", status: "NOT_CONFIGURED", count: 0 },
        ],
      })
    );
    expect(outcome).toEqual({ kind: "no_matches" });
  });

  it("reports results with no partial failure when properties came back cleanly", () => {
    const outcome = describeSearchOutcome(
      makeResult({
        properties: [makeProperty("1")],
        providerCoverage: [
          { provider: "uhomes", status: "SEARCHED", count: 1 },
          { provider: "uniacco", status: "NO_RESULTS", count: 0 },
          { provider: "university_living", status: "NOT_CONFIGURED", count: 0 },
          { provider: "gradding_homes", status: "NOT_CONFIGURED", count: 0 },
        ],
      })
    );
    expect(outcome).toEqual({ kind: "results", hasPartialFailure: false });
  });

  it("reports results with hasPartialFailure when one provider errored/was unavailable alongside real results", () => {
    const outcome = describeSearchOutcome(
      makeResult({
        properties: [makeProperty("1")],
        providerCoverage: [
          { provider: "uhomes", status: "SEARCHED", count: 1 },
          { provider: "uniacco", status: "UNAVAILABLE", count: 0, reason: "rate limited" },
          { provider: "university_living", status: "NOT_CONFIGURED", count: 0 },
          { provider: "gradding_homes", status: "NOT_CONFIGURED", count: 0 },
        ],
      })
    );
    expect(outcome).toEqual({ kind: "results", hasPartialFailure: true });
  });

  it("a single provider ERROR alongside real results never fails the whole search", () => {
    const outcome = describeSearchOutcome(
      makeResult({
        properties: [makeProperty("1")],
        providerCoverage: [
          { provider: "uhomes", status: "SEARCHED", count: 1 },
          { provider: "uniacco", status: "ERROR", count: 0, reason: "malformed response" },
          { provider: "university_living", status: "NOT_CONFIGURED", count: 0 },
          { provider: "gradding_homes", status: "NOT_CONFIGURED", count: 0 },
        ],
      })
    );
    expect(outcome.kind).toBe("results");
  });
});
