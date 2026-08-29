// Structural source assertions for the Find Rooms workflow — same
// "read the source, assert a pattern" convention the IVYHUTS backend's own
// scripts/verify-*.js "STRUCTURAL:" tests already use (see e.g.
// verify-derby-housing.js), applied here for behaviors that are properties
// of the CODE rather than of any single function's return value: "never
// auto-search," "never touch Amber," "exactly four providers."
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PROPERTY_SOURCES } from "@/types/property";

const FIND_ROOMS_SECTION = path.join(__dirname, "..", "FindRoomsSection.tsx");
const FIND_ROOMS_DIR = path.join(__dirname, "..");
const FIND_ROOMS_LIB_DIR = path.join(__dirname, "..", "..", "..", "lib", "findRooms");

function read(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

function allSourceFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts"))
    .map((entry) => path.join(dir, entry.name));
}

describe("STRUCTURAL: explicit search only", () => {
  it("searchFindRooms is called exactly once in the whole Find Rooms UI — from handleSearch, never from a useEffect", () => {
    const src = read(FIND_ROOMS_SECTION);
    const callSites = src.match(/searchFindRooms\(/g) ?? [];
    // One call site inside handleSearch's body, one in the import statement
    // does not count (import uses `{ searchFindRooms }`, no trailing "(").
    expect(callSites.length).toBe(1);
  });

  it("the searchFindRooms call site is inside handleSearch, not inside any useEffect body", () => {
    const src = read(FIND_ROOMS_SECTION);
    const handleSearchStart = src.indexOf("async function handleSearch");
    const searchCallIndex = src.indexOf("searchFindRooms(");
    expect(handleSearchStart).toBeGreaterThan(-1);
    expect(searchCallIndex).toBeGreaterThan(handleSearchStart);

    // No useEffect body anywhere in the file contains the searchFindRooms
    // call — walk every useEffect(() => { ... }, [...]) block and check.
    const effectBlocks = [...src.matchAll(/useEffect\(\(\) => \{/g)];
    for (const match of effectBlocks) {
      const start = match.index!;
      // Find this effect's matching closing "}, [" (its dependency array
      // start) — good enough for this file's actual effect shapes.
      const depArrayStart = src.indexOf("}, [", start);
      const effectBody = src.slice(start, depArrayStart);
      expect(effectBody.includes("searchFindRooms(")).toBe(false);
    }
  });

  it("resolveUniversity (the read-only lookup) IS allowed inside a useEffect — sanity check that the test above isn't vacuous", () => {
    const src = read(FIND_ROOMS_SECTION);
    expect(src.includes("resolveUniversity(")).toBe(true);
  });
});

describe("STRUCTURAL: no Amber in the Find Rooms workflow", () => {
  // Excludes Tailwind's `amber-*` color utility classes (amber-600,
  // amber-50, ...) used purely for warning-state styling — those aren't a
  // reference to the Amber integration. Anything else spelling "amber"
  // (amberGateway, api/amber, "Amber", etc.) still fails this test.
  const AMBER_REFERENCE = /\bamber(?!-\d)/i;

  it("no Find Rooms component or lib file references the Amber integration", () => {
    const files = [...allSourceFiles(FIND_ROOMS_DIR), ...allSourceFiles(FIND_ROOMS_LIB_DIR)];
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const src = read(file);
      expect(AMBER_REFERENCE.test(src)).toBe(false);
    }
  });

  it("sanity check: the amber-color-class exclusion doesn't just blind the check entirely", () => {
    expect(AMBER_REFERENCE.test("border-amber-200 bg-amber-50")).toBe(false);
    expect(AMBER_REFERENCE.test("import amberGateway from './amberGateway'")).toBe(true);
    expect(AMBER_REFERENCE.test("api/amber")).toBe(true);
  });
});

describe("STRUCTURAL: exactly four providers, in sync with the real backend registry", () => {
  it("PROPERTY_SOURCES is exactly uhomes/uniacco/university_living/gradding_homes", () => {
    expect([...PROPERTY_SOURCES].sort()).toEqual(["gradding_homes", "uhomes", "uniacco", "university_living"]);
  });

  it("PROPERTY_SOURCES never contains amber", () => {
    expect((PROPERTY_SOURCES as readonly string[]).includes("amber")).toBe(false);
  });
});

describe("STRUCTURAL: no N+1 — searchFindRooms is the only network call the results grid depends on", () => {
  it("no per-property or per-provider fetch/apiRequest call exists in the property result card", () => {
    const src = read(path.join(FIND_ROOMS_DIR, "PropertyResultCard.tsx"));
    expect(/\bfetch\(/.test(src)).toBe(false);
    expect(/apiRequest\(/.test(src)).toBe(false);
  });
});

describe("STRUCTURAL: no autosave (Milestone 23.6 Part 16)", () => {
  it("saveAccommodationCuration is called exactly once — from handleSave, never from a useEffect", () => {
    const src = read(FIND_ROOMS_SECTION);
    const callSites = src.match(/saveAccommodationCuration\(/g) ?? [];
    expect(callSites.length).toBe(1);

    const handleSaveStart = src.indexOf("async function handleSave");
    const saveCallIndex = src.indexOf("saveAccommodationCuration(");
    expect(handleSaveStart).toBeGreaterThan(-1);
    expect(saveCallIndex).toBeGreaterThan(handleSaveStart);

    const effectBlocks = [...src.matchAll(/useEffect\(\(\) => \{/g)];
    for (const match of effectBlocks) {
      const start = match.index!;
      const depArrayStart = src.indexOf("}, [", start);
      const effectBody = src.slice(start, depArrayStart);
      expect(effectBody.includes("saveAccommodationCuration(")).toBe(false);
    }
  });

  it("getAccommodationCuration (the read-only load) IS allowed inside a useEffect — sanity check the test above isn't vacuous", () => {
    const src = read(FIND_ROOMS_SECTION);
    expect(src.includes("getAccommodationCuration(")).toBe(true);
  });
});
