// CRM-facing shape for the IVYHUTS backend's REAL, existing university
// resolver — GET /api/universities/resolve (api/universities/resolve.js ->
// api/_lib/universityResolveService.js). Verified directly against that
// source, Milestone 23.3. This is the authoritative university source; the
// CRM's own src/lib/property-intelligence/university/* fixture resolver
// (Milestone 23.1) is explicit scaffolding and must NOT be expanded — see
// that module's README.md.
//
// The backend's raw response is `{ok, status, data, reason}` (see
// resolveUniversityHandler's toPublicUniversityShape) — this file maps
// that into the cleaner resolved/unresolved contract Milestone 23.3 asks
// for, without changing the backend's own public/UX-oriented endpoint.

export interface ResolvedUniversity {
  id: string;
  name: string;
  type: "UNIVERSITY" | "SCHOOL";
  city: string | null;
  country: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  verified: boolean;
  discovered: boolean;
}

export type UniversityResolution =
  | { resolved: true; university: ResolvedUniversity }
  // "ambiguous" carries real candidates from the backend's escalation
  // pipeline — surfaced rather than silently discarded or collapsed into a
  // single guessed answer. An agent must pick one; nothing here does.
  | { resolved: false; query: string; reason: "ambiguous"; candidates: ResolvedUniversity[] }
  | { resolved: false; query: string; reason: string };
