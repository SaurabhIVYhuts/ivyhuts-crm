import { describe, expect, it } from "vitest";
import { formatAvailability, formatCriteriaSummary, formatDistanceKm, formatRent, formatSharing } from "../format";
import type { SearchedCriteriaSnapshot } from "../staleness";

describe("formatRent", () => {
  it("formats a known weekly rent with currency", () => {
    expect(formatRent(190, "GBP", "week")).toBe("GBP 190 / week");
  });
  it("formats monthly and nightly periods", () => {
    expect(formatRent(1200, "GBP", "month")).toBe("GBP 1200 / month");
    expect(formatRent(50, "GBP", "night")).toBe("GBP 50 / night");
  });
  it("never shows 0 or a fabricated value for a missing rent — 'Not provided' instead", () => {
    expect(formatRent(null, "GBP", "week")).toBe("Not provided");
  });
  it("omits a currency symbol when currency is unknown, rather than guessing one", () => {
    expect(formatRent(190, null, "week")).toBe("190 / week");
  });
});

describe("formatSharing", () => {
  it("formats a known sharing count", () => {
    expect(formatSharing(2)).toBe("2 sharing");
  });
  it("labels 1 as private/single rather than '1 sharing'", () => {
    expect(formatSharing(1)).toBe("Private / single");
  });
  it("shows 'Not provided' for missing sharing, never 0", () => {
    expect(formatSharing(null)).toBe("Not provided");
  });
});

describe("formatDistanceKm", () => {
  it("formats sub-km distances in meters", () => {
    expect(formatDistanceKm(0.8)).toBe("800 m from university");
  });
  it("formats km-scale distances with one decimal", () => {
    expect(formatDistanceKm(2.47)).toBe("2.5 km from university");
  });
  it("shows 'Not provided' for missing distance, never 0", () => {
    expect(formatDistanceKm(null)).toBe("Not provided");
  });
});

describe("formatAvailability", () => {
  it("formats available/unavailable", () => {
    expect(formatAvailability("available")).toBe("Available");
    expect(formatAvailability("unavailable")).toBe("Unavailable");
  });
  it("shows 'Not provided' for unknown availability", () => {
    expect(formatAvailability("unknown")).toBe("Not provided");
  });
});

describe("formatCriteriaSummary — Milestone 23.17", () => {
  const base: SearchedCriteriaSnapshot = { university: "University of Hertfordshire", budgetMin: 150, budgetMax: 250, currency: "GBP", sharing: 2 };

  it("shows 'Not provided' for a null snapshot", () => {
    expect(formatCriteriaSummary(null)).toBe("Not provided");
  });

  it("includes the currency in the budget range so a currency-only change is a visibly different summary", () => {
    expect(formatCriteriaSummary(base)).toBe("University of Hertfordshire · GBP 150–250/week · 2 sharing");
    expect(formatCriteriaSummary({ ...base, currency: "USD" })).toBe("University of Hertfordshire · USD 150–250/week · 2 sharing");
  });

  it("omits a currency symbol when currency is unknown, rather than guessing one", () => {
    expect(formatCriteriaSummary({ ...base, currency: null })).toBe("University of Hertfordshire · 150–250/week · 2 sharing");
  });

  it("falls back to honest 'not set' phrasing for missing fields, never a fabricated value", () => {
    expect(formatCriteriaSummary({ university: null, budgetMin: null, budgetMax: null, currency: null, sharing: null })).toBe(
      "university not set · budget not set · sharing not set"
    );
  });
});
