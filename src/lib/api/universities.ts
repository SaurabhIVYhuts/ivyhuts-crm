// Wraps GET /api/universities/resolve on the IVYHUTS backend
// (api/universities/resolve.js). Contract verified directly against that
// source, Milestone 23.3 — this is a REAL, existing, working endpoint
// (unlike several other aspirational src/lib/api/*.ts clients flagged in
// the Milestone 23.2 audit). Public/unauthenticated on the backend, but
// still routed through apiRequest for consistent base-URL/error handling;
// see api/_lib/cors.js for why this now works cross-origin from the CRM.
//
// This is the authoritative university source for the CRM — do not
// resolve a university any other way. See src/types/university.ts's
// header comment.
import { apiRequest } from "./client";
import type { ResolvedUniversity, UniversityResolution } from "@/types/university";

interface RawResolveResponse {
  ok: boolean;
  status: string;
  data: ResolvedUniversity | ResolvedUniversity[] | null;
  reason?: string;
}

export async function resolveUniversity(query: string): Promise<UniversityResolution> {
  const trimmed = query.trim();
  if (!trimmed) return { resolved: false, query: trimmed, reason: "empty_query" };

  const res = await apiRequest<RawResolveResponse>("/api/universities/resolve", {
    method: "GET",
    query: { q: trimmed },
  });

  if (res.status === "resolved" && res.data && !Array.isArray(res.data)) {
    return { resolved: true, university: res.data };
  }
  if (res.status === "ambiguous" && Array.isArray(res.data)) {
    return { resolved: false, query: trimmed, reason: "ambiguous", candidates: res.data };
  }
  return { resolved: false, query: trimmed, reason: res.reason || res.status || "not_found" };
}
