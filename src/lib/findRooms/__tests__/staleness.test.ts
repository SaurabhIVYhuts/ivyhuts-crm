import { describe, expect, it } from "vitest";
import { criteriaChanged, type SearchedCriteriaSnapshot } from "../staleness";

const base: SearchedCriteriaSnapshot = { university: "University of Hertfordshire", budgetMin: 150, budgetMax: 250, currency: "GBP", sharing: 2 };

describe("criteriaChanged", () => {
  it("is false when nothing has been searched yet (last is null) — 'not yet searched', not 'stale'", () => {
    expect(criteriaChanged(null, base)).toBe(false);
  });

  it("is false when current criteria match the last search exactly", () => {
    expect(criteriaChanged(base, { ...base })).toBe(false);
  });

  it("is true when budget changes", () => {
    expect(criteriaChanged(base, { ...base, budgetMin: 200 })).toBe(true);
  });

  it("is true when sharing changes", () => {
    expect(criteriaChanged(base, { ...base, sharing: 3 })).toBe(true);
  });

  it("is true when university changes", () => {
    expect(criteriaChanged(base, { ...base, university: "University of Manchester" })).toBe(true);
  });

  it("Milestone 23.17 — is true when currency changes on an otherwise identical numeric budget (GBP 150-250 and USD 150-250 are not the same budget)", () => {
    expect(criteriaChanged(base, { ...base, currency: "USD" })).toBe(true);
  });
});
