// Deduplication is identity-based ONLY. Two CanonicalProperty records
// collapse into one exactly when they share a propertyId (see
// identity.ts) — same provider reporting the same listing twice (e.g.
// pagination overlap, a retried search). Cross-provider listings that
// merely look similar (same name, same building) are never merged here —
// see README.md "Deduplication strategy" for why false-positive merges are
// worse than showing a near-duplicate twice.

import type { CanonicalProperty } from "./types";

// When the same propertyId appears more than once, keeps the record with
// the more recent sourceUpdatedAt (freshest data wins); if neither/both
// are unknown, keeps the first occurrence.
export function dedupeCanonicalProperties(properties: CanonicalProperty[]): CanonicalProperty[] {
  const byId = new Map<string, CanonicalProperty>();

  for (const property of properties) {
    const existing = byId.get(property.propertyId);
    if (!existing) {
      byId.set(property.propertyId, property);
      continue;
    }

    const existingTime = existing.sourceUpdatedAt ? Date.parse(existing.sourceUpdatedAt) : NaN;
    const candidateTime = property.sourceUpdatedAt ? Date.parse(property.sourceUpdatedAt) : NaN;
    if (!Number.isNaN(candidateTime) && (Number.isNaN(existingTime) || candidateTime > existingTime)) {
      byId.set(property.propertyId, property);
    }
  }

  return Array.from(byId.values());
}
