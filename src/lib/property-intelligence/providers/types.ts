// Provider-neutral adapter contract. The CRM/business layer calls
// searchProperties(criteria) and gets back normalized CanonicalProperty
// records — it never learns how (or whether) a given provider actually
// fetches data. See README.md "Provider adapter interface".

import type { CanonicalProperty, PropertyProvider, PropertySearchCriteria } from "../types";

// "ok": the adapter ran and returned zero or more properties.
// "not_implemented": this adapter has no real integration yet (the honest
//   state for all four providers right now — see README.md "Providers
//   actually implemented"). Distinct from "unavailable", which is reserved
//   for a provider a Phase 1 audit found to be genuinely unreachable.
// "unavailable": the provider was reached but could not serve this
//   request (or was marked unavailable by an audit) — never used to smuggle
//   in a fallback source.
// "error": the adapter attempted real work and it failed.
export type ProviderSearchStatus = "ok" | "not_implemented" | "unavailable" | "error";

export interface ProviderSearchResult {
  status: ProviderSearchStatus;
  properties: CanonicalProperty[];
  reason?: string;
}

export interface ProviderAdapter {
  readonly provider: PropertyProvider;
  searchProperties(criteria: PropertySearchCriteria): Promise<ProviderSearchResult>;
}
