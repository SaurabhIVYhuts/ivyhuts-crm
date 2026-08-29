// Shared "not implemented" adapter factory. Used by all four provider
// adapters right now (see README.md "Providers actually implemented" for
// why: no Phase 1 audit established that calling real provider
// infrastructure from this repo is safe/configured, and the CRM's
// existing architecture already fetches provider data server-side — see
// src/lib/api/properties.ts). Never fabricates results and never invents
// an endpoint.

import type { PropertyProvider } from "../types";
import type { ProviderAdapter, ProviderSearchResult } from "./types";

export function createNotImplementedAdapter(provider: PropertyProvider, reason: string): ProviderAdapter {
  return {
    provider,
    async searchProperties(): Promise<ProviderSearchResult> {
      return { status: "not_implemented", properties: [], reason };
    },
  };
}

// Explicit UNAVAILABLE state for a provider a real audit has confirmed is
// unreachable/unusable. Not used by any adapter today — kept here so a
// future audit finding has a place to plug into without inventing a new
// shape. Never falls back to another provider.
export function createUnavailableAdapter(provider: PropertyProvider, reason: string): ProviderAdapter {
  return {
    provider,
    async searchProperties(): Promise<ProviderSearchResult> {
      return { status: "unavailable", properties: [], reason };
    },
  };
}
