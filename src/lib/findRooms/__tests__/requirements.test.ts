import { describe, expect, it } from "vitest";
import { deriveFindRoomsRequirements } from "../requirements";
import type { Discovery, DiscoveryAccommodation, DiscoveryStudent } from "@/types/discovery";

function makeDiscovery(
  studentOverrides: Partial<DiscoveryStudent> = {},
  accommodationOverrides: Partial<DiscoveryAccommodation> = {}
): Discovery {
  return {
    id: "d1",
    leadId: "lead1",
    student: { university: "University of Hertfordshire", universityResolved: null, course: null, intake: null, ...studentOverrides },
    accommodation: {
      budgetMin: 150,
      budgetMax: 250,
      currency: "GBP",
      moveInDate: null,
      stayDurationMonths: null,
      preferredLocation: null,
      roomPreference: "2 Sharing",
      sharing: null,
      distancePreference: null,
      ...accommodationOverrides,
    },
    priorities: [],
    notes: null,
    requirementSources: { university: null, budget: null, sharing: null },
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("deriveFindRoomsRequirements", () => {
  it("is complete when university, budget, and sharing are all present", () => {
    const result = deriveFindRoomsRequirements(makeDiscovery());
    expect(result.isComplete).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.university).toBe("University of Hertfordshire");
    expect(result.budgetMin).toBe(150);
    expect(result.budgetMax).toBe(250);
    expect(result.sharing).toBe(2);
  });

  it("flags missing university", () => {
    const result = deriveFindRoomsRequirements(makeDiscovery({ university: null }));
    expect(result.isComplete).toBe(false);
    expect(result.missing).toContain("university");
  });

  it("flags missing budget when both budgetMin and budgetMax are null", () => {
    const result = deriveFindRoomsRequirements(makeDiscovery({}, { budgetMin: null, budgetMax: null }));
    expect(result.isComplete).toBe(false);
    expect(result.missing).toContain("budget");
  });

  it("does not flag budget when only budgetMin is present", () => {
    const result = deriveFindRoomsRequirements(makeDiscovery({}, { budgetMin: 150, budgetMax: null }));
    expect(result.missing).not.toContain("budget");
  });

  it("flags missing sharing when roomPreference cannot be parsed into a count", () => {
    const result = deriveFindRoomsRequirements(makeDiscovery({}, { roomPreference: "Not sure yet" }));
    expect(result.isComplete).toBe(false);
    expect(result.missing).toContain("sharing");
    expect(result.sharing).toBeNull();
  });

  it("flags missing sharing when roomPreference is entirely absent", () => {
    const result = deriveFindRoomsRequirements(makeDiscovery({}, { roomPreference: null }));
    expect(result.missing).toContain("sharing");
  });

  it("derives sharing from recognizable room-preference text", () => {
    expect(deriveFindRoomsRequirements(makeDiscovery({}, { roomPreference: "Single" })).sharing).toBe(1);
    expect(deriveFindRoomsRequirements(makeDiscovery({}, { roomPreference: "Twin room" })).sharing).toBe(2);
  });

  it("reports all three fields missing at once when Discovery has not been started", () => {
    const result = deriveFindRoomsRequirements(null);
    expect(result.isComplete).toBe(false);
    expect(result.missing).toEqual(["university", "budget", "sharing"]);
  });

  // ── Milestone 23.7: explicit accommodation.sharing vs. legacy roomPreference derivation ──
  it("prefers the explicit numeric sharing field when present, and reports its source as 'explicit'", () => {
    const result = deriveFindRoomsRequirements(makeDiscovery({}, { sharing: 3, roomPreference: "Twin room" }));
    expect(result.sharing).toBe(3);
    expect(result.sharingSource).toBe("explicit");
  });

  it("falls back to deriving from roomPreference only when explicit sharing is null (legacy records)", () => {
    const result = deriveFindRoomsRequirements(makeDiscovery({}, { sharing: null, roomPreference: "2 Sharing" }));
    expect(result.sharing).toBe(2);
    expect(result.sharingSource).toBe("derived");
  });

  it("never guesses — sharingSource is null when sharing is genuinely missing", () => {
    const result = deriveFindRoomsRequirements(makeDiscovery({}, { sharing: null, roomPreference: null }));
    expect(result.sharing).toBeNull();
    expect(result.sharingSource).toBeNull();
  });

  it("an explicit sharing of 0 or negative is treated the same as null (never a valid explicit value)", () => {
    // Backend validation rejects this at write time, but derivation must
    // stay defensive against any data that somehow doesn't satisfy that.
    const result = deriveFindRoomsRequirements(makeDiscovery({}, { sharing: 0, roomPreference: "2 Sharing" }));
    expect(result.sharing).toBe(2);
    expect(result.sharingSource).toBe("derived");
  });

  it("surfaces currency alongside budget", () => {
    const result = deriveFindRoomsRequirements(makeDiscovery({}, { currency: "USD" }));
    expect(result.currency).toBe("USD");
  });

  it("currency is null when Discovery hasn't set one, never defaulted", () => {
    const result = deriveFindRoomsRequirements(makeDiscovery({}, { currency: null }));
    expect(result.currency).toBeNull();
  });
});
