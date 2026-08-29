// Detects when the agent has changed University/Budget/Sharing in
// Discovery since the last Find Rooms search — Milestone 23.5 Part 25:
// the existing shortlist/results must never silently keep looking current
// against requirements that have since changed, but must also never be
// cleared or auto-refreshed on the agent's behalf. The UI's only
// responsibility on a "stale" result is to say so and let the agent
// explicitly search again.
export interface SearchedCriteriaSnapshot {
  university: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  // Milestone 23.17 — Discovery has captured accommodation.currency since
  // Milestone 23.7 (required whenever a budget bound is set; see
  // api/_lib/models/Discovery.js), and it's already part of both
  // FindRoomsSearchCriteria and the persisted CriteriaSnapshot
  // (buildCriteria.ts / curationSync.ts) — but this comparator never
  // picked it up, so a currency-only change (e.g. GBP -> USD on the same
  // numeric budget) went completely undetected: neither the "stale vs last
  // search" nor "stale vs saved shortlist" banner would fire, even though
  // the budget now means something entirely different. Deliberately NOT
  // adding moveInDate/stayDurationMonths/preferredDistance/amenities here
  // — those are per-search FILTER choices (see buildCriteria.ts's
  // FindRoomsFilters), not Discovery-derived facts, so a Discovery change
  // has no bearing on them.
  currency: string | null;
  sharing: number | null;
}

// `last` is null before any search has ever run — that's "not yet
// searched", not "stale", so this returns false rather than true.
export function criteriaChanged(last: SearchedCriteriaSnapshot | null, current: SearchedCriteriaSnapshot): boolean {
  if (!last) return false;
  return (
    last.university !== current.university ||
    last.budgetMin !== current.budgetMin ||
    last.budgetMax !== current.budgetMax ||
    last.currency !== current.currency ||
    last.sharing !== current.sharing
  );
}
