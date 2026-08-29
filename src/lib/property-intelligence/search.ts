// Business-layer entry point: fans out a search across every registered
// provider adapter, in parallel, and merges the results. This is the only
// place that knows the full provider list — callers just get back
// deduplicated properties plus a per-provider status map (mirroring the
// shape of the CRM's existing ProviderSourceStatus in src/types/property.ts,
// so a future UI can reuse the same rendering pattern).

import { dedupeCanonicalProperties } from "./dedupe";
import { PROVIDER_ADAPTERS } from "./providers/registry";
import type { ProviderSearchStatus } from "./providers/types";
import { type CriteriaValidation, type PropertyProvider, type PropertySearchCriteria, validateMinimumCriteria } from "./types";

export interface AggregatedSearchResult {
  properties: import("./types").CanonicalProperty[];
  sources: Record<PropertyProvider, { status: ProviderSearchStatus; count: number; reason?: string }>;
}

export type SearchProperties = { status: "ok"; result: AggregatedSearchResult } | { status: "invalid"; validation: CriteriaValidation };

export async function searchAllProviders(criteria: PropertySearchCriteria): Promise<SearchProperties> {
  const validation = validateMinimumCriteria(criteria);
  if (!validation.valid) {
    return { status: "invalid", validation };
  }

  const entries = Object.entries(PROVIDER_ADAPTERS) as [PropertyProvider, (typeof PROVIDER_ADAPTERS)[PropertyProvider]][];

  const results = await Promise.all(
    entries.map(async ([provider, adapter]) => {
      const providerResult = await adapter.searchProperties(criteria);
      return [provider, providerResult] as const;
    })
  );

  const allProperties = results.flatMap(([, providerResult]) => providerResult.properties);

  const sources = Object.fromEntries(
    results.map(([provider, providerResult]) => [
      provider,
      { status: providerResult.status, count: providerResult.properties.length, reason: providerResult.reason },
    ])
  ) as AggregatedSearchResult["sources"];

  return {
    status: "ok",
    result: {
      properties: dedupeCanonicalProperties(allProperties),
      sources,
    },
  };
}
