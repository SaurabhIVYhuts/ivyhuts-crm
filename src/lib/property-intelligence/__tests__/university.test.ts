import { describe, expect, it } from "vitest";
import { resolveUniversity } from "../university/resolver";

describe("resolveUniversity", () => {
  it("resolves an exact known university name", () => {
    const result = resolveUniversity("University College London");
    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") return;
    expect(result.university).toMatchObject({
      name: "University College London",
      city: "London",
      country: "United Kingdom",
    });
    expect(result.university.latitude).toBeCloseTo(51.5246);
  });

  it("resolves via a known alias, case- and whitespace-insensitively", () => {
    const result = resolveUniversity("  ucl  ");
    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") return;
    expect(result.university.name).toBe("University College London");
  });

  it("returns unresolved for an unknown university without inventing coordinates", () => {
    const result = resolveUniversity("Totally Made Up University");
    expect(result).toEqual({ status: "unresolved", query: "Totally Made Up University" });
  });

  it("returns unresolved for empty/whitespace input", () => {
    expect(resolveUniversity("").status).toBe("unresolved");
    expect(resolveUniversity("   ").status).toBe("unresolved");
    expect(resolveUniversity(undefined).status).toBe("unresolved");
  });
});
