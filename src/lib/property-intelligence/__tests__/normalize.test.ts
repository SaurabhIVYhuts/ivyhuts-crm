import { describe, expect, it } from "vitest";
import {
  computeRentPerWeek,
  normalizeAvailability,
  normalizeCurrency,
  normalizeProviderProperty,
  normalizeRent,
  normalizeRentPeriod,
  normalizeSharing,
} from "../normalize";

describe("normalizeProviderProperty", () => {
  it("normalizes a fully-populated raw property", () => {
    const result = normalizeProviderProperty("uhomes", {
      providerPropertyId: "abc123",
      name: "  Sky Gardens  ",
      url: "https://Uhomes.com/UK/sky-gardens/?utm_source=x",
      slug: "sky-gardens",
      image: "https://cdn.example.com/a.jpg",
      images: ["https://cdn.example.com/a.jpg", "", "https://cdn.example.com/b.jpg"],
      city: "London",
      country: "United Kingdom",
      latitude: 51.5,
      longitude: -0.12,
      rent: "£1,200",
      currency: "£",
      rentPeriod: "per month",
      roomType: "2 Sharing",
      availability: "available",
      amenities: ["wifi", "gym"],
      sourceUpdatedAt: "2026-08-01T00:00:00.000Z",
      providerMeta: { rawScore: 4.5 },
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.property).toMatchObject({
      provider: "uhomes",
      providerPropertyId: "abc123",
      propertyId: "uhomes:id:abc123",
      name: "Sky Gardens",
      city: "London",
      country: "United Kingdom",
      latitude: 51.5,
      longitude: -0.12,
      rent: 1200,
      currency: "GBP",
      rentPeriod: "month",
      sharing: 2,
      availability: "available",
      amenities: ["wifi", "gym"],
      distanceFromUniversityKm: null,
    });
    expect(result.property.images).toEqual(["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"]);
    expect(result.property.providerMeta).toEqual({ rawScore: 4.5 });
    expect(result.property.rentPerWeek).toBeCloseTo((1200 * 12) / 52);
  });

  it("degrades missing optional fields to null/unknown rather than failing", () => {
    const result = normalizeProviderProperty("uniacco", {
      providerPropertyId: "id-1",
      name: "Minimal Listing",
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.property).toMatchObject({
      url: null,
      image: null,
      city: null,
      country: null,
      latitude: null,
      longitude: null,
      rent: null,
      currency: null,
      rentPeriod: "unknown",
      rentPerWeek: null,
      sharing: null,
      availability: "unknown",
      providerMeta: null,
      distanceFromUniversityKm: null,
    });
    expect(result.property.images).toEqual([]);
    expect(result.property.amenities).toEqual([]);
  });

  it("fails when the name is missing", () => {
    const result = normalizeProviderProperty("uhomes", { providerPropertyId: "abc" });
    expect(result.status).toBe("invalid");
  });

  it("fails when neither providerPropertyId nor url is present", () => {
    const result = normalizeProviderProperty("uhomes", { name: "Nameless Tower" });
    expect(result.status).toBe("invalid");
    if (result.status !== "invalid") return;
    expect(result.reason).toMatch(/identity/i);
  });

  it("falls back to a URL-derived identity when providerPropertyId is absent", () => {
    const result = normalizeProviderProperty("university_living", {
      name: "Riverside Court",
      url: "https://university-living.com/uk/riverside-court/",
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.property.propertyId).toBe("university_living:slug:university-living.com/uk/riverside-court");
  });
});

describe("normalizeRent", () => {
  it.each([
    ["£1,250", 1250],
    ["1250", 1250],
    [1250, 1250],
    ["", null],
    ["free", null],
    [0, null],
    [-50, null],
    [undefined, null],
  ])("normalizes %p -> %p", (input, expected) => {
    expect(normalizeRent(input)).toBe(expected);
  });
});

describe("normalizeCurrency", () => {
  it.each([
    ["£", "GBP"],
    ["gbp", "GBP"],
    ["$", "USD"],
    ["XYZ", null],
    ["", null],
    [undefined, null],
  ])("normalizes %p -> %p", (input, expected) => {
    expect(normalizeCurrency(input)).toBe(expected);
  });
});

describe("normalizeRentPeriod", () => {
  it.each([
    ["per week", "week"],
    ["pcm", "month"],
    ["nightly", "night"],
    ["quarterly", "unknown"],
    [undefined, "unknown"],
  ])("normalizes %p -> %p", (input, expected) => {
    expect(normalizeRentPeriod(input)).toBe(expected);
  });
});

describe("computeRentPerWeek", () => {
  it("passes weekly rent through unchanged", () => {
    expect(computeRentPerWeek(200, "week")).toBe(200);
  });
  it("converts monthly rent to a weekly equivalent", () => {
    expect(computeRentPerWeek(1200, "month")).toBeCloseTo((1200 * 12) / 52);
  });
  it("converts nightly rent to a weekly equivalent", () => {
    expect(computeRentPerWeek(50, "night")).toBe(350);
  });
  it("is null when the period is unknown, even if rent is known — never estimated from a partial period", () => {
    expect(computeRentPerWeek(1200, "unknown")).toBeNull();
  });
  it("is null when rent itself is null", () => {
    expect(computeRentPerWeek(null, "week")).toBeNull();
  });
});

describe("normalizeSharing", () => {
  it.each([
    ["2 Sharing", 2],
    ["Twin room", 2],
    ["Single", 1],
    ["Studio", 1],
    ["Triple", 3],
    [4, 4],
    ["", null],
    ["Deluxe Ensuite", 1],
    ["unspecified", null],
    [-1, null],
  ])("normalizes %p -> %p", (input, expected) => {
    expect(normalizeSharing(input)).toBe(expected);
  });
});

describe("normalizeAvailability", () => {
  it.each([
    [true, "available"],
    [false, "unavailable"],
    ["sold_out", "unavailable"],
    ["yes", "available"],
    ["maybe", "unknown"],
    [undefined, "unknown"],
  ])("normalizes %p -> %p", (input, expected) => {
    expect(normalizeAvailability(input)).toBe(expected);
  });
});
