// Public surface of the property-intelligence domain layer. CRM
// components should import from here (or from these named modules)
// rather than reaching into providers/* directly — that keeps
// provider-specific structures from leaking into UI code.

export { dedupeCanonicalProperties } from "./dedupe";
export { computePropertyId, normalizeUrlForIdentity } from "./identity";
export {
  computeRentPerWeek,
  normalizeAvailability,
  normalizeCurrency,
  normalizeProviderProperty,
  normalizeRent,
  normalizeRentPeriod,
  normalizeSharing,
  normalizeStringArray,
} from "./normalize";
export type { NormalizationResult, RawProviderProperty } from "./normalize";
export { PROVIDER_ADAPTERS } from "./providers/registry";
export type { ProviderAdapter, ProviderSearchResult, ProviderSearchStatus } from "./providers/types";
export { searchAllProviders } from "./search";
export type { AggregatedSearchResult, SearchProperties } from "./search";
export {
  PROPERTY_PROVIDERS,
  type CanonicalProperty,
  type CriteriaValidation,
  type PropertyAvailability,
  type PropertyProvider,
  type PropertySearchCriteria,
  type RentPeriod,
  validateMinimumCriteria,
} from "./types";
export { resolveUniversity } from "./university/resolver";
export type { ResolvedUniversity, UniversityResolution } from "./university/resolver";
