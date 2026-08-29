// University resolution. See data.ts for why this fixture-backed resolver
// is a placeholder, and README.md "University resolution strategy" for the
// intended replacement path.
//
// A university either resolves fully (name, city, country, lat/long) or it
// doesn't — there is no partial/guessed resolution. Coordinates are never
// invented for an unresolved query.

import { UNIVERSITY_FIXTURES } from "./data";

export interface ResolvedUniversity {
  name: string;
  aliases: string[];
  city: string;
  country: string;
  latitude: number;
  longitude: number;
}

export type UniversityResolution =
  | { status: "resolved"; university: ResolvedUniversity }
  | { status: "unresolved"; query: string };

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function resolveUniversity(query: string | null | undefined): UniversityResolution {
  const trimmed = (query ?? "").trim();
  if (!trimmed) {
    return { status: "unresolved", query: trimmed };
  }

  const normalizedQuery = normalize(trimmed);
  const match = UNIVERSITY_FIXTURES.find(
    (candidate) => normalize(candidate.name) === normalizedQuery || candidate.aliases.some((alias) => normalize(alias) === normalizedQuery)
  );

  if (!match) {
    return { status: "unresolved", query: trimmed };
  }

  return { status: "resolved", university: match };
}
