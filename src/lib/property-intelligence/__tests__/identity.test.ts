import { describe, expect, it } from "vitest";
import { computePropertyId, normalizeUrlForIdentity } from "../identity";

describe("computePropertyId", () => {
  it("prefers provider + providerPropertyId", () => {
    const result = computePropertyId("uhomes", "P-42", "https://uhomes.com/p/42");
    expect(result).toEqual({ status: "ok", propertyId: "uhomes:id:P-42" });
  });

  it("falls back to a normalized URL when providerPropertyId is absent", () => {
    const result = computePropertyId("uniacco", null, "https://uniacco.com/listing/foo/");
    expect(result).toEqual({ status: "ok", propertyId: "uniacco:slug:uniacco.com/listing/foo" });
  });

  it("is invalid when both providerPropertyId and url are absent", () => {
    const result = computePropertyId("gradding_homes", null, null);
    expect(result.status).toBe("invalid");
  });

  it("is invalid when url is present but unparseable", () => {
    const result = computePropertyId("gradding_homes", null, "not a url ::");
    expect(result.status).toBe("invalid");
  });

  it("treats whitespace-only providerPropertyId as absent", () => {
    const result = computePropertyId("uhomes", "   ", "https://uhomes.com/p/42");
    expect(result).toEqual({ status: "ok", propertyId: "uhomes:slug:uhomes.com/p/42" });
  });
});

describe("normalizeUrlForIdentity", () => {
  it("treats protocol, trailing slash, query string, and case as identity-irrelevant", () => {
    const a = normalizeUrlForIdentity("https://Example.com/Listing/42/?ref=abc");
    const b = normalizeUrlForIdentity("http://example.com/listing/42");
    expect(a).toBe(b);
  });

  it("treats a different path as a different identity", () => {
    const a = normalizeUrlForIdentity("https://example.com/listing/42");
    const b = normalizeUrlForIdentity("https://example.com/listing/43");
    expect(a).not.toBe(b);
  });
});
