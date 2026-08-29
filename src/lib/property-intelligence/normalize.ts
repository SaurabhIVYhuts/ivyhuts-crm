// Pure normalization functions. Every function here is total (never
// throws) and never fabricates a value — when input is missing, absent,
// or not confidently parseable, the result is null/"unknown" rather than
// a guess. See README.md "Normalization" for the field-by-field rationale.

import { computePropertyId } from "./identity";
import type { CanonicalProperty, PropertyAvailability, PropertyProvider, RentPeriod } from "./types";

// Shape of whatever a provider adapter has on hand before normalization.
// Deliberately loose (`unknown` on ambiguous fields) — this is the
// boundary where un-trusted, un-shaped provider data enters the system.
export interface RawProviderProperty {
  providerPropertyId?: string | null;
  name?: string | null;
  url?: string | null;
  slug?: string | null;
  image?: string | null;
  images?: unknown;
  city?: string | null;
  country?: string | null;
  latitude?: unknown;
  longitude?: unknown;
  rent?: unknown;
  currency?: unknown;
  rentPeriod?: unknown;
  roomType?: string | null;
  sharing?: unknown;
  availability?: unknown;
  amenities?: unknown;
  sourceUpdatedAt?: string | null;
  providerMeta?: Record<string, unknown> | null;
}

export type NormalizationResult =
  | { status: "ok"; property: CanonicalProperty }
  | { status: "invalid"; reason: string };

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const cleaned = value.replace(/[,\s]/g, "");
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

// Rent must be a positive finite number. Strips currency symbols/commas
// from string input ("£1,200" -> 1200) but never infers a value from
// nothing.
export function normalizeRent(raw: unknown): number | null {
  let value = raw;
  if (typeof value === "string") {
    value = value.replace(/[^0-9.,-]/g, "");
  }
  const num = toFiniteNumber(value);
  if (num == null || num <= 0) return null;
  return num;
}

const KNOWN_CURRENCY_CODES = new Set(["GBP", "USD", "EUR", "AUD", "CAD", "INR"]);
const SYMBOL_TO_CURRENCY: Record<string, string> = {
  "£": "GBP",
  $: "USD",
  "€": "EUR",
  "₹": "INR",
};

// Only returns an ISO-4217 code when confidently identified from a known
// code or a well-known symbol. Anything else is preserved as unknown
// (null) rather than guessed.
export function normalizeCurrency(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (SYMBOL_TO_CURRENCY[trimmed]) return SYMBOL_TO_CURRENCY[trimmed];
  const upper = trimmed.toUpperCase();
  if (KNOWN_CURRENCY_CODES.has(upper)) return upper;
  return null;
}

export function normalizeRentPeriod(raw: unknown): RentPeriod {
  if (typeof raw !== "string") return "unknown";
  const lower = raw.trim().toLowerCase();
  if (["week", "wk", "weekly", "pw", "per week"].includes(lower)) return "week";
  if (["month", "mo", "monthly", "pcm", "per month"].includes(lower)) return "month";
  if (["night", "nightly", "per night"].includes(lower)) return "night";
  return "unknown";
}

// Cross-provider comparison field — see CanonicalProperty.rentPerWeek's
// own comment. Null unless rent+rentPeriod are both confidently known.
export function computeRentPerWeek(rent: number | null, rentPeriod: RentPeriod): number | null {
  if (rent == null) return null;
  if (rentPeriod === "week") return rent;
  if (rentPeriod === "month") return (rent * 12) / 52;
  if (rentPeriod === "night") return rent * 7;
  return null;
}

const SHARING_WORD_MAP: Record<string, number> = {
  single: 1,
  studio: 1,
  ensuite: 1,
  private: 1,
  twin: 2,
  double: 2,
  triple: 3,
  quad: 4,
};

// Parses room-type/sharing text into a people-per-room count only when the
// mapping is unambiguous ("2 Sharing" -> 2, "Twin" -> 2, "Single" -> 1).
// Anything else (empty, unrecognized word, non-numeric noise) returns
// null — sharing is one of the three hard minimums, so a wrong guess here
// is worse than an honest "unknown".
export function normalizeSharing(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null;
  }
  if (typeof raw !== "string") return null;
  const lower = raw.trim().toLowerCase();
  if (!lower) return null;

  const numericMatch = lower.match(/(\d+)\s*(?:sharing|share|person|people|bed)?/);
  if (numericMatch) {
    const num = Number(numericMatch[1]);
    if (Number.isFinite(num) && num > 0) return num;
  }

  for (const [word, count] of Object.entries(SHARING_WORD_MAP)) {
    if (lower.includes(word)) return count;
  }

  return null;
}

export function normalizeAvailability(raw: unknown): PropertyAvailability {
  if (typeof raw === "boolean") return raw ? "available" : "unavailable";
  if (typeof raw === "string") {
    const lower = raw.trim().toLowerCase();
    if (["available", "in_stock", "yes", "true"].includes(lower)) return "available";
    if (["unavailable", "sold_out", "no", "false", "fully_booked"].includes(lower)) return "unavailable";
  }
  return "unknown";
}

export function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

function normalizeString(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length ? trimmed : null;
}

// Normalizes one raw provider listing into a CanonicalProperty. Fails
// (status "invalid") only when identity cannot be computed (see
// identity.ts) or when the listing has no name — every other field
// degrades to null/"unknown" rather than blocking normalization.
export function normalizeProviderProperty(provider: PropertyProvider, raw: RawProviderProperty): NormalizationResult {
  const name = normalizeString(raw.name);
  if (!name) {
    return { status: "invalid", reason: "missing required field: name" };
  }

  const url = normalizeString(raw.url);
  const identity = computePropertyId(provider, raw.providerPropertyId, url);
  if (identity.status === "invalid") {
    return { status: "invalid", reason: `could not determine property identity: ${identity.reason}` };
  }

  const rent = normalizeRent(raw.rent);
  const rentPeriod = normalizeRentPeriod(raw.rentPeriod);

  const property: CanonicalProperty = {
    provider,
    providerPropertyId: normalizeString(raw.providerPropertyId),
    propertyId: identity.propertyId,
    name,
    url,
    slug: normalizeString(raw.slug),
    image: normalizeString(raw.image),
    images: normalizeStringArray(raw.images),
    city: normalizeString(raw.city),
    country: normalizeString(raw.country),
    latitude: toFiniteNumber(raw.latitude),
    longitude: toFiniteNumber(raw.longitude),
    rent,
    currency: normalizeCurrency(raw.currency),
    rentPeriod,
    rentPerWeek: computeRentPerWeek(rent, rentPeriod),
    roomType: normalizeString(raw.roomType),
    sharing: normalizeSharing(raw.sharing ?? raw.roomType),
    availability: normalizeAvailability(raw.availability),
    amenities: normalizeStringArray(raw.amenities),
    sourceUpdatedAt: normalizeString(raw.sourceUpdatedAt),
    distanceFromUniversityKm: null,
    providerMeta: raw.providerMeta && Object.keys(raw.providerMeta).length ? raw.providerMeta : null,
  };

  return { status: "ok", property };
}
