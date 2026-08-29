import { describe, expect, it } from "vitest";
import { BLANK_FIND_ROOMS_FILTERS, buildFindRoomsCriteria, buildUniversityInput } from "../buildCriteria";
import type { FindRoomsRequirements } from "../requirements";
import type { ResolvedUniversity } from "@/types/university";

const completeRequirements: FindRoomsRequirements = {
  university: "University of Hertfordshire",
  budgetMin: 150,
  budgetMax: 250,
  currency: "GBP",
  sharing: 2,
  sharingSource: "explicit",
  missing: [],
  isComplete: true,
};

const resolved: ResolvedUniversity = {
  id: "university-of-hertfordshire",
  name: "University of Hertfordshire",
  type: "UNIVERSITY",
  city: "Hatfield",
  country: "United Kingdom",
  address: null,
  latitude: 51.7636,
  longitude: -0.2405,
  verified: true,
  discovered: false,
};

describe("buildUniversityInput", () => {
  it("uses the resolved university (with coordinates) when available", () => {
    const input = buildUniversityInput(completeRequirements, resolved);
    expect(input).toEqual({
      id: "university-of-hertfordshire",
      name: "University of Hertfordshire",
      city: "Hatfield",
      country: "United Kingdom",
      latitude: 51.7636,
      longitude: -0.2405,
    });
  });

  it("falls back to the free-text Discovery university (no coordinates) when unresolved", () => {
    const input = buildUniversityInput(completeRequirements, null);
    expect(input).toEqual({ name: "University of Hertfordshire" });
  });
});

describe("buildFindRoomsCriteria", () => {
  it("returns null when requirements are incomplete — never sends a partial search", () => {
    const incomplete: FindRoomsRequirements = { ...completeRequirements, sharing: null, missing: ["sharing"], isComplete: false };
    expect(buildFindRoomsCriteria(incomplete, resolved, BLANK_FIND_ROOMS_FILTERS)).toBeNull();
  });

  it("constructs the exact criteria payload from requirements + resolved university + filters", () => {
    const criteria = buildFindRoomsCriteria(completeRequirements, resolved, {
      roomType: "Ensuite",
      moveInDate: "2026-09-01",
      stayDurationMonths: "12",
      preferredDistance: "2",
      amenities: "wifi, gym",
    });
    expect(criteria).toEqual({
      university: {
        id: "university-of-hertfordshire",
        name: "University of Hertfordshire",
        city: "Hatfield",
        country: "United Kingdom",
        latitude: 51.7636,
        longitude: -0.2405,
      },
      budgetMin: 150,
      budgetMax: 250,
      currency: "GBP",
      sharing: 2,
      roomType: "Ensuite",
      moveInDate: "2026-09-01",
      stayDurationMonths: 12,
      preferredDistance: 2,
      amenities: ["wifi", "gym"],
    });
  });

  it("omits blank optional filters rather than sending empty strings", () => {
    const criteria = buildFindRoomsCriteria(completeRequirements, resolved, BLANK_FIND_ROOMS_FILTERS);
    expect(criteria?.roomType).toBeUndefined();
    expect(criteria?.moveInDate).toBeUndefined();
    expect(criteria?.stayDurationMonths).toBeUndefined();
    expect(criteria?.preferredDistance).toBeUndefined();
    expect(criteria?.amenities).toEqual([]);
  });
});
