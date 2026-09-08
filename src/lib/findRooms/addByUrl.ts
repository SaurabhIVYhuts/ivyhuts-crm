// CRM plan item 7 — turn a pasted accommodation listing URL into a
// CuratedProperty the agent can save on a lead, WITHOUT any server fetch:
// identity is derived from the URL itself (host → provider, then the
// shared computePropertyId rules). Rich fields the page might contain
// (rent, image, room type) are deliberately left null — nothing is
// scraped or guessed here. A recognised host keeps that provider's
// identity so the entry dedupes against a Find Rooms result for the same
// listing; anything else is "other".
import { computePropertyId, normalizeUrlForIdentity, type PropertyProvider } from "@/lib/property-intelligence";
import type { PropertySource } from "@/types/property";
import type { CuratedProperty } from "@/types/accommodationCuration";

const HOST_PROVIDER: Array<{ test: RegExp; provider: PropertyProvider }> = [
  { test: /(^|\.)uhomes\.com$/i, provider: "uhomes" },
  { test: /(^|\.)uniacco\.com$/i, provider: "uniacco" },
  { test: /(^|\.)universityliving\.com$/i, provider: "university_living" },
  { test: /(^|\.)gradding\.com$/i, provider: "gradding_homes" },
  { test: /(^|\.)graddinghomes\.com$/i, provider: "gradding_homes" },
];

function providerForHost(host: string): PropertySource {
  for (const { test, provider } of HOST_PROVIDER) if (test.test(host)) return provider;
  return "other";
}

// A readable name from the URL when the agent didn't type one: the last
// non-numeric path segment, de-slugified.
function nameFromUrl(parsed: URL): string {
  const segments = parsed.pathname.split("/").filter(Boolean);
  const last = [...segments].reverse().find((s) => !/^\d+$/.test(s)) || parsed.hostname;
  return last
    .replace(/[-_]+/g, " ")
    .replace(/\.[a-z]+$/i, "")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export type AddByUrlResult = { ok: true; property: CuratedProperty } | { ok: false; error: string };

export function buildCuratedPropertyFromUrl(rawUrl: string, nameHint?: string): AddByUrlResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { ok: false, error: "Paste a property link first." };

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Only http(s) links can be saved." };
  }

  const provider = providerForHost(parsed.hostname);
  const url = parsed.toString();

  let propertyId: string;
  if (provider === "other") {
    const slug = normalizeUrlForIdentity(url);
    if (!slug) return { ok: false, error: "Couldn't read that link." };
    propertyId = `other:slug:${slug}`;
  } else {
    const id = computePropertyId(provider, null, url);
    if (id.status !== "ok") return { ok: false, error: "Couldn't derive an identity for that link." };
    propertyId = id.propertyId;
  }

  const name = (nameHint && nameHint.trim()) || nameFromUrl(parsed);

  return {
    ok: true,
    property: {
      provider,
      providerPropertyId: null,
      propertyId,
      name,
      url,
      slug: null,
      image: null,
      city: null,
      country: null,
      latitude: null,
      longitude: null,
      rent: null,
      rentPerWeek: null,
      currency: null,
      rentPeriod: "unknown",
      roomType: null,
      sharing: null,
      availability: "unknown",
      amenities: [],
      distanceFromUniversityKm: null,
      advantages: null,
      disadvantages: null,
      providerMeta: { addedFrom: "pasted_link" },
    },
  };
}
