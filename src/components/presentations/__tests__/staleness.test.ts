// Milestone 23.20 — presentation freshness disclosure tests. Milestone
// 23.21 adds version-property-summary formatting tests to the same file
// (both are pure logic exported from PresentationsSection.tsx — no
// jsdom/RTL in this repo, see SalesJourney.tsx's own export comment for
// the convention this follows).
import { describe, expect, it } from "vitest";
import { formatPresentationPropertySummary, isPresentationStale } from "../PresentationsSection";
import type { Presentation, PresentationProperty } from "@/types/presentation";

function makeLatest(generatedFrom: Partial<Presentation["generatedFrom"]> = {}): Pick<Presentation, "generatedFrom"> {
  return {
    generatedFrom: {
      accommodationCurationId: "curation1",
      accommodationCurationUpdatedAt: "2026-01-01T00:00:00.000Z",
      discoveryId: "discovery1",
      discoveryUpdatedAt: "2026-01-01T00:00:00.000Z",
      ...generatedFrom,
    },
  };
}

describe("isPresentationStale", () => {
  it("is false when curation/discovery haven't changed since generation", () => {
    const latest = makeLatest();
    expect(isPresentationStale(latest, { updatedAt: "2026-01-01T00:00:00.000Z" }, { updatedAt: "2026-01-01T00:00:00.000Z" })).toBe(false);
  });

  it("is true when the curation was saved again AFTER this version was generated", () => {
    const latest = makeLatest();
    expect(isPresentationStale(latest, { updatedAt: "2026-01-02T00:00:00.000Z" }, { updatedAt: "2026-01-01T00:00:00.000Z" })).toBe(true);
  });

  it("is true when Discovery was confirmed/edited AFTER this version was generated", () => {
    const latest = makeLatest();
    expect(isPresentationStale(latest, { updatedAt: "2026-01-01T00:00:00.000Z" }, { updatedAt: "2026-01-02T00:00:00.000Z" })).toBe(true);
  });

  it("is true when Discovery now exists but didn't when this version was generated (discoveryUpdatedAt was null)", () => {
    const latest = makeLatest({ discoveryUpdatedAt: null });
    expect(isPresentationStale(latest, { updatedAt: "2026-01-01T00:00:00.000Z" }, { updatedAt: "2026-01-05T00:00:00.000Z" })).toBe(true);
  });

  it("is false when Discovery still doesn't exist at all (both null) — nothing new to disclose", () => {
    const latest = makeLatest({ discoveryUpdatedAt: null });
    expect(isPresentationStale(latest, { updatedAt: "2026-01-01T00:00:00.000Z" }, null)).toBe(false);
  });

  it("never throws when curation is null (defensive — the real component always has one by the time a presentation exists)", () => {
    const latest = makeLatest();
    expect(isPresentationStale(latest, null, null)).toBe(false);
  });

  it("Milestone 23.21 — the SAME comparator works for an OLDER version, not just the latest one (no second freshness algorithm)", () => {
    const v1 = makeLatest({ accommodationCurationUpdatedAt: "2026-01-01T00:00:00.000Z" });
    // v1 was generated before a later curation edit — must read as stale
    // even though it isn't the latest version.
    expect(isPresentationStale(v1, { updatedAt: "2026-02-01T00:00:00.000Z" }, null)).toBe(true);
  });
});

function makeProperty(overrides: Partial<PresentationProperty> = {}): PresentationProperty {
  return { propertyId: "uhomes:id:abc123", name: "Luna Hatfield", provider: "uhomes", roomType: "Ensuite", rent: 190, currency: "GBP", rentPeriod: "week", city: "Hatfield", country: "United Kingdom", ...overrides };
}

describe("formatPresentationPropertySummary — Milestone 23.21", () => {
  it("includes name, room type, and price when all are known", () => {
    expect(formatPresentationPropertySummary(makeProperty())).toBe("Luna Hatfield — Ensuite — GBP 190/week");
  });

  it("omits the price entirely when rent or currency is genuinely unknown — never a fabricated placeholder", () => {
    expect(formatPresentationPropertySummary(makeProperty({ rent: null }))).toBe("Luna Hatfield — Ensuite");
    expect(formatPresentationPropertySummary(makeProperty({ currency: null }))).toBe("Luna Hatfield — Ensuite");
  });

  it("omits the rent period suffix when the period is genuinely unknown, but still shows the amount", () => {
    expect(formatPresentationPropertySummary(makeProperty({ rentPeriod: "unknown" }))).toBe("Luna Hatfield — Ensuite — GBP 190");
  });

  it("omits room type when it's genuinely unknown", () => {
    expect(formatPresentationPropertySummary(makeProperty({ roomType: null }))).toBe("Luna Hatfield — GBP 190/week");
  });
});
