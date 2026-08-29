// Deterministic property identity. See README.md section "Deduplication
// strategy" for the reasoning.
//
// Preferred identity: provider + providerPropertyId.
// Fallback (only when providerPropertyId is absent): provider + a stable
// normalized URL/slug.
// If neither is available, identity cannot be computed — callers must
// treat that as invalid input, never guess an ID.

import type { PropertyProvider } from "./types";

export type PropertyIdentityResult =
  | { status: "ok"; propertyId: string }
  | { status: "invalid"; reason: string };

// Normalizes a listing URL into a stable, comparable slug: lowercased host
// + path, protocol dropped, query string and fragment dropped (tracking
// params are provider noise, not identity), trailing slash dropped. Two
// URLs that differ only in protocol, query string, or trailing slash
// normalize to the same slug; two URLs with different paths do not.
export function normalizeUrlForIdentity(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    const path = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.hostname.toLowerCase()}${path.toLowerCase()}`;
  } catch {
    return null;
  }
}

export function computePropertyId(
  provider: PropertyProvider,
  providerPropertyId: string | null | undefined,
  url: string | null | undefined
): PropertyIdentityResult {
  const trimmedProviderId = providerPropertyId?.trim();
  if (trimmedProviderId) {
    return { status: "ok", propertyId: `${provider}:id:${trimmedProviderId}` };
  }

  if (url && url.trim()) {
    const normalized = normalizeUrlForIdentity(url);
    if (normalized) {
      return { status: "ok", propertyId: `${provider}:slug:${normalized}` };
    }
    return { status: "invalid", reason: "url present but could not be normalized" };
  }

  return { status: "invalid", reason: "neither providerPropertyId nor url was provided" };
}
