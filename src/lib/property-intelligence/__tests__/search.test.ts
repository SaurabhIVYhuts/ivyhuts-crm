import { describe, expect, it } from "vitest";
import { PROVIDER_ADAPTERS } from "../providers/registry";
import { searchAllProviders } from "../search";
import { type PropertySearchCriteria, validateMinimumCriteria } from "../types";

const validCriteria: PropertySearchCriteria = {
  university: "University College London",
  budgetMin: 200,
  budgetMax: 350,
  sharing: 2,
};

describe("validateMinimumCriteria", () => {
  it("accepts university + budget (min or max) + sharing", () => {
    expect(validateMinimumCriteria(validCriteria)).toEqual({ valid: true });
    expect(validateMinimumCriteria({ ...validCriteria, budgetMin: null })).toEqual({ valid: true });
    expect(validateMinimumCriteria({ ...validCriteria, budgetMax: null })).toEqual({ valid: true });
  });

  it("does not require optional Discovery fields", () => {
    const minimal: PropertySearchCriteria = { university: "X", budgetMin: 100, sharing: 1 };
    expect(validateMinimumCriteria(minimal)).toEqual({ valid: true });
  });

  it("rejects missing university", () => {
    const result = validateMinimumCriteria({ ...validCriteria, university: "" });
    expect(result).toEqual({ valid: false, missing: ["university"] });
  });

  it("rejects missing budget", () => {
    const result = validateMinimumCriteria({ ...validCriteria, budgetMin: null, budgetMax: null });
    expect(result).toEqual({ valid: false, missing: ["budget"] });
  });

  it("rejects missing/invalid sharing", () => {
    expect(validateMinimumCriteria({ ...validCriteria, sharing: 0 })).toEqual({ valid: false, missing: ["sharing"] });
    expect(validateMinimumCriteria({ ...validCriteria, sharing: undefined as unknown as number })).toEqual({
      valid: false,
      missing: ["sharing"],
    });
  });

  it("reports all missing fields at once", () => {
    const result = validateMinimumCriteria({ university: "", budgetMin: null, budgetMax: null, sharing: 0 });
    expect(result).toEqual({ valid: false, missing: ["university", "budget", "sharing"] });
  });
});

describe("searchAllProviders", () => {
  it("rejects a search below the minimum criteria without calling any adapter", async () => {
    const result = await searchAllProviders({ university: "", budgetMin: null, budgetMax: null, sharing: 0 });
    expect(result.status).toBe("invalid");
  });

  it("fans out to every registered provider and reports not_implemented honestly", async () => {
    const result = await searchAllProviders(validCriteria);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    expect(Object.keys(result.result.sources).sort()).toEqual(Object.keys(PROVIDER_ADAPTERS).sort());
    for (const source of Object.values(result.result.sources)) {
      expect(source.status).toBe("not_implemented");
      expect(source.count).toBe(0);
    }
    expect(result.result.properties).toEqual([]);
  });
});
