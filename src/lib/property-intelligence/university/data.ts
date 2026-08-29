// PLACEHOLDER fixture data — see README.md "University resolution
// strategy" and "Decisions still required". The milestone spec says to
// reuse an existing university resolver/data source rather than build a
// second one; no such resolver exists anywhere in this repo (the only
// prior university handling is the free-text DiscoveryStudent.university
// field in src/types/discovery.ts, which has no coordinates or resolution
// logic at all). This is a small, explicitly-fixture dataset — a real data
// source decision is still required before this can be trusted in
// production. Do not add entries with invented/guessed coordinates.

import type { ResolvedUniversity } from "./resolver";

export const UNIVERSITY_FIXTURES: ResolvedUniversity[] = [
  {
    name: "University College London",
    aliases: ["ucl"],
    city: "London",
    country: "United Kingdom",
    latitude: 51.5246,
    longitude: -0.1339,
  },
  {
    name: "University of Manchester",
    aliases: ["manchester university", "uom"],
    city: "Manchester",
    country: "United Kingdom",
    latitude: 53.4668,
    longitude: -2.2339,
  },
  {
    name: "University of Birmingham",
    aliases: ["birmingham university"],
    city: "Birmingham",
    country: "United Kingdom",
    latitude: 52.4508,
    longitude: -1.9305,
  },
  {
    name: "Coventry University",
    aliases: [],
    city: "Coventry",
    country: "United Kingdom",
    latitude: 52.4014,
    longitude: -1.5086,
  },
];
