# Property Intelligence (Milestone 23.1)

Canonical property/domain foundation for turning "university + budget +
sharing" into candidate accommodation options. This is a new domain layer
under `src/lib/property-intelligence/` — it does not replace or call the
existing Competitive Analysis feature (`src/types/property.ts`,
`src/lib/api/properties.ts`), which talks to the live backend's
`/api/properties/search` endpoint. See "How this relates to the existing
Competitive Analysis feature" below.

## Why this exists / what's missing

No Phase 1 provider-capability audit was available in this repo, in
persistent memory, or in a sibling backend repo when this milestone was
built (none could be found on disk). Per explicit direction from the
product owner, this was built on a **minimal safe assumption** instead of
real audit data:

- Every provider (UHomes, UniAcco, University Living, Gradding Homes) is
  treated as reliably supporting only `name`, `url`, `rent`, `currency`,
  `city`.
- Every other canonical field is optional/unknown unless a caller actually
  supplies it — nothing is guessed.
- No provider is marked `unavailable`; all four adapters currently return
  `not_implemented` (see "Providers actually implemented").

Wherever this assumption drove a decision, it's called out below and in
"Decisions still required".

## 1. Canonical property schema

`types.ts` — `CanonicalProperty`. Every field from the milestone spec's
minimum list is present: `provider`, `providerPropertyId`, `propertyId`,
`name`, `url`, `slug`, `image`, `images`, `city`, `country`, `latitude`,
`longitude`, `rent`, `currency`, `rentPeriod`, `roomType`, `sharing`,
`availability`, `amenities`, `sourceUpdatedAt`, plus a `providerMeta` bag
for provider-specific data that doesn't fit the canonical shape (isolated
here so it never needs to leak into CRM components).

## 2. Provider adapter interface

`providers/types.ts` — `ProviderAdapter.searchProperties(criteria)`
returns normalized `CanonicalProperty[]` plus a status
(`ok | not_implemented | unavailable | error`). The business layer
(`search.ts`) only ever talks to this interface — it has no idea how (or
whether) any given provider actually fetches data.

## 3. Providers actually implemented

None have a real network integration in this repo. All four
(`providers/uhomes.ts`, `uniacco.ts`, `universityLiving.ts`,
`graddingHomes.ts`) are `createNotImplementedAdapter(...)` stubs that
return `{ status: "not_implemented", properties: [] }`. This is
intentional, not an oversight:

- No audit confirmed it's safe/configured to call real provider
  infrastructure from this repo (milestone rule: don't, absent that).
- The CRM's existing architecture already fetches provider data
  server-side, in the separate `ivyhuts-website` backend
  (`api/_lib/providers/accommodation/`) — this repo is documented
  (`src/lib/api/properties.ts`) as never talking to providers directly.

`providers/notImplemented.ts` also exports `createUnavailableAdapter`,
kept ready for when a real audit marks a specific provider unreachable —
distinct from "not implemented" so the two states don't get conflated
later.

## 4. Providers intentionally unavailable

None, per the minimal-safe-assumption direction above (Amber is excluded
from the provider set entirely — it was never one of the four approved
sources; see `src/types/property.ts`).

## 5. Deduplication strategy

`dedupe.ts` collapses records **only** when they share a computed
`propertyId` (same provider reporting the identical listing twice — e.g.
paginated/retried search results). Cross-provider listings that merely
look similar (same building, similar name) are never merged: false
deduplication would silently hide genuinely distinct offers from an
agent, which is a worse failure than showing a near-duplicate twice. On a
collision, the record with the more recent `sourceUpdatedAt` wins; ties or
unknown timestamps keep the first occurrence.

## 6. University resolution strategy

`university/resolver.ts` + `university/data.ts`. **No existing university
resolver was found anywhere in this repo** — the only prior handling is
the free-text `DiscoveryStudent.university` string in
`src/types/discovery.ts`, with no coordinates or resolution logic. The
milestone spec says to reuse an existing resolver rather than build a
second one; since none exists, this is a small, explicitly-fixture-backed
resolver (4 sample UK universities) meant as scaffolding, not a production
data source — see "Decisions still required".

Resolution is exact-match only (name or known alias, case/whitespace
normalized) and returns a discriminated `resolved | unresolved` result.
Unresolved universities never get invented coordinates.

## 7. Property identity

`identity.ts` — `computePropertyId(provider, providerPropertyId, url)`:

1. `provider:id:{providerPropertyId}` when the provider gives a stable ID.
2. Else `provider:slug:{normalizedUrl}` — URL normalized by dropping
   protocol, query string, fragment, and trailing slash, lowercasing host
   and path.
3. Else `invalid` — normalization refuses to guess an identity.

## 8. Normalization

`normalize.ts` — pure, total functions (`normalizeRent`,
`normalizeCurrency`, `normalizeRentPeriod`, `normalizeSharing`,
`normalizeAvailability`, `normalizeStringArray`) composed by
`normalizeProviderProperty`, which only fails when `name` is missing or
identity can't be computed. Every other field degrades to `null` /
`"unknown"` rather than guessing — e.g. `normalizeCurrency` only returns a
code for a small known set of symbols/codes (£, $, €, ₹, GBP/USD/EUR/AUD/
CAD/INR); anything else is `null`, never inferred from locale or rent
magnitude.

## How this relates to the existing Competitive Analysis feature

`src/types/property.ts`'s `PropertySummary` and
`src/lib/api/properties.ts`'s `searchProperties()` are the **live**
feature: they call the real backend, which already fans out to the four
providers server-side and returns already-normalized, backend-projected
results. `CanonicalProperty` here is intentionally richer (coordinates,
plural images, amenities, availability, `sourceUpdatedAt`) because it's
building toward the fuller "Find Rooms" flow in the milestone brief, not
replacing today's Competitive Analysis picker. The two are not wired
together; that integration is future work, not part of this milestone.

## Decisions still required

1. **Real Phase 1 provider audit.** Every "reliable field" assumption in
   this module is a placeholder pending real per-provider field audit
   data. When that audit exists, revisit `normalize.ts` (e.g. can
   `sharing`/`roomType`/`availability` actually be trusted per provider?)
   and `providers/*.ts` (should any adapter move from `not_implemented` to
   a real integration, or to `unavailable`?).
2. **University data source.** Decide whether to build/reuse a real
   university database (with coordinates) — the four-entry fixture in
   `university/data.ts` is not production data.
3. **Provider network integration.** None of the four adapters call real
   infrastructure. Decide whether provider fetching should ever happen
   from this CRM repo, or whether `searchAllProviders` should instead call
   the existing backend `/api/properties/search` endpoint as its one
   "adapter" (which would keep the CRM's "never talk to providers
   directly" rule intact end-to-end).
4. **Wiring into the CRM UI.** This milestone is domain/foundation only —
   no UI consumes `search.ts` yet.
