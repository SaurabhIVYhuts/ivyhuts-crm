// Classifies a completed search response into the distinct UI states
// Milestone 23.5 Part 20 requires — "no connected providers" and "no
// properties matched" are different states with different meanings and
// must never be conflated into one generic empty state.
import type { FindRoomsSearchResult, ProviderCoverageStatus } from "@/types/property";

export type SearchOutcome =
  // Every provider is NOT_CONFIGURED — an infrastructure limitation, not a
  // real empty search result.
  | { kind: "no_providers_configured" }
  // At least one provider was actually searched, but zero properties
  // matched the requirements.
  | { kind: "no_matches" }
  // At least one property was returned. hasPartialFailure is true when at
  // least one OTHER provider was UNAVAILABLE/ERROR alongside real results
  // — the UI must still render the properties it has, never fail the
  // whole search over one provider's problem (Part 21).
  | { kind: "results"; hasPartialFailure: boolean };

const REACHABLE_STATUSES: ProviderCoverageStatus[] = ["SEARCHED", "NO_RESULTS", "UNAVAILABLE", "ERROR"];

export function describeSearchOutcome(result: FindRoomsSearchResult): SearchOutcome {
  const anyReachable = result.providerCoverage.some((c) => REACHABLE_STATUSES.includes(c.status));
  if (!anyReachable) return { kind: "no_providers_configured" };

  if (result.properties.length === 0) return { kind: "no_matches" };

  const hasPartialFailure = result.providerCoverage.some((c) => c.status === "UNAVAILABLE" || c.status === "ERROR");
  return { kind: "results", hasPartialFailure };
}
