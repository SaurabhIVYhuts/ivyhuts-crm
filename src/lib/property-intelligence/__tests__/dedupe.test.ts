import { describe, expect, it } from "vitest";
import { dedupeCanonicalProperties } from "../dedupe";
import { normalizeProviderProperty } from "../normalize";
import type { CanonicalProperty } from "../types";

function makeProperty(overrides: Partial<CanonicalProperty>): CanonicalProperty {
  const base = normalizeProviderProperty("uhomes", {
    providerPropertyId: "base-id",
    name: "Base Listing",
  });
  if (base.status !== "ok") throw new Error("fixture setup failed");
  return { ...base.property, ...overrides };
}

describe("dedupeCanonicalProperties", () => {
  it("collapses records that share a propertyId", () => {
    const a = makeProperty({ propertyId: "uhomes:id:1", sourceUpdatedAt: null });
    const b = makeProperty({ propertyId: "uhomes:id:1", sourceUpdatedAt: null });
    const result = dedupeCanonicalProperties([a, b]);
    expect(result).toHaveLength(1);
  });

  it("keeps the most recently updated record on collision", () => {
    const older = makeProperty({ propertyId: "uhomes:id:1", name: "Old", sourceUpdatedAt: "2026-01-01T00:00:00.000Z" });
    const newer = makeProperty({ propertyId: "uhomes:id:1", name: "New", sourceUpdatedAt: "2026-06-01T00:00:00.000Z" });
    const result = dedupeCanonicalProperties([older, newer]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("New");
  });

  it("does not merge different properties that merely look similar", () => {
    const a = makeProperty({ propertyId: "uhomes:id:1", name: "Sky Gardens" });
    const b = makeProperty({ propertyId: "uniacco:id:1", name: "Sky Gardens" });
    const result = dedupeCanonicalProperties([a, b]);
    expect(result).toHaveLength(2);
  });

  it("handles an empty list", () => {
    expect(dedupeCanonicalProperties([])).toEqual([]);
  });
});
