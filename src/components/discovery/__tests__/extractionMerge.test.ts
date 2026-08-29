// Milestone 23.16 — regression coverage for the Transcript -> Agent
// Confirmation -> Discovery handoff. Pure logic only (no jsdom/RTL in this
// repo — see SalesJourney.tsx's own export comment for the convention this
// follows).
//
// The bug this guards against: Discovery's PUT is a partial dot-path merge
// where an OMITTED key is left untouched but a key that IS present (even
// null) CLEARS it (src/types/discovery.ts's DiscoveryInput comment). The
// pre-fix extractionToPayload/extractionToFormValues always sent every
// field, including ones the transcript never mentioned (honestly null on
// the extraction) — which the backend then read as "clear this field",
// silently wiping an already-confirmed budget/sharing/move-in-date/etc.
// whenever a later transcript only re-confirmed part of Discovery.
import { describe, expect, it } from "vitest";
import { extractionToPayload, extractionToFormValues } from "../DiscoverySection";
import type { ExtractedRequirements } from "@/types/meeting";
import type { Discovery } from "@/types/discovery";

function makeExtraction(overrides: Partial<ExtractedRequirements> = {}): ExtractedRequirements {
  return {
    status: "pending_review",
    extractedAt: "2026-01-01T00:00:00.000Z",
    university: null,
    course: null,
    intake: null,
    budgetMin: null,
    budgetMax: null,
    currency: null,
    moveInDate: null,
    stayDurationMonths: null,
    preferredLocation: null,
    roomPreference: null,
    sharing: null,
    distancePreference: null,
    priorities: [],
    notes: null,
    ...overrides,
  };
}

function makeDiscovery(overrides: Partial<Discovery> = {}): Discovery {
  return {
    id: "disc1",
    leadId: "lead1",
    student: { university: null, universityResolved: null, course: null, intake: null },
    accommodation: {
      budgetMin: null,
      budgetMax: null,
      currency: null,
      moveInDate: null,
      stayDurationMonths: null,
      preferredLocation: null,
      roomPreference: null,
      sharing: null,
      distancePreference: null,
    },
    priorities: [],
    notes: null,
    requirementSources: { university: null, budget: null, sharing: null },
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("extractionToPayload — only transcript-supported fields are ever sent", () => {
  it("a university-only extraction sends ONLY student.university and its provenance — no accommodation key at all", () => {
    const payload = extractionToPayload(makeExtraction({ university: "UCL" }));
    expect(payload.student).toEqual({ university: "UCL" });
    expect(payload.accommodation).toBeUndefined();
    expect(payload.requirementSources).toEqual({ university: "transcript" });
    expect(payload.priorities).toBeUndefined();
    expect(payload.notes).toBeUndefined();
  });

  it("THE BUG THIS FIXES: does not include accommodation fields the transcript left null, so an already-confirmed budget/sharing on Discovery is never wiped by the backend's partial merge", () => {
    const payload = extractionToPayload(makeExtraction({ university: "UCL", sharing: null, budgetMin: null }));
    // Previously this payload would have carried `accommodation: { budgetMin: null, ..., sharing: null, ... }`,
    // which the backend's mergeAndCollectSetPaths treats as an explicit clear for every one of those keys.
    expect(payload.accommodation).toBeUndefined();
    expect(payload.requirementSources?.sharing).toBeUndefined();
    expect(payload.requirementSources?.budget).toBeUndefined();
  });

  it("a full extraction sends every supported field plus matching provenance", () => {
    const payload = extractionToPayload(
      makeExtraction({ university: "UCL", budgetMin: 150, budgetMax: 250, currency: "GBP", sharing: 2, priorities: ["budget"], notes: "Prefers ensuite." })
    );
    expect(payload.student).toEqual({ university: "UCL" });
    expect(payload.accommodation).toEqual({ budgetMin: 150, budgetMax: 250, currency: "GBP", sharing: 2 });
    expect(payload.requirementSources).toEqual({ university: "transcript", budget: "transcript", sharing: "transcript" });
    expect(payload.priorities).toEqual(["budget"]);
    expect(payload.notes).toBe("Prefers ensuite.");
  });

  it("currency alone (no budgetMin/budgetMax) still counts as touching budget for provenance", () => {
    const payload = extractionToPayload(makeExtraction({ currency: "GBP" }));
    expect(payload.accommodation).toEqual({ currency: "GBP" });
    expect(payload.requirementSources).toEqual({ budget: "transcript" });
  });

  it("an empty priorities[] is never sent — it means 'transcript didn't say', not 'confirm zero priorities'", () => {
    const payload = extractionToPayload(makeExtraction({ university: "UCL", priorities: [] }));
    expect(payload.priorities).toBeUndefined();
  });

  it("a fully-empty extraction produces an empty payload — nothing to confirm, nothing sent", () => {
    const payload = extractionToPayload(makeExtraction());
    expect(payload).toEqual({});
  });
});

describe("extractionToFormValues — Review & Edit shows the TRUE effective merge, never a fake blank", () => {
  it("THE BUG THIS FIXES: an already-confirmed budget/sharing is preserved in the pre-filled form when the new transcript only mentions university", () => {
    const discovery = makeDiscovery({
      accommodation: { budgetMin: 150, budgetMax: 250, currency: "GBP", moveInDate: null, stayDurationMonths: null, preferredLocation: null, roomPreference: null, sharing: 2, distancePreference: null },
      requirementSources: { university: "agent", budget: "agent", sharing: "agent" },
    });
    const values = extractionToFormValues(makeExtraction({ university: "UCL" }), discovery);
    expect(values.university).toBe("UCL");
    // Previously these would have rendered as "" (blank) — an agent who
    // hit Save without noticing would have wiped real, already-confirmed data.
    expect(values.budgetMin).toBe("150");
    expect(values.budgetMax).toBe("250");
    expect(values.currency).toBe("GBP");
    expect(values.sharing).toBe("2");
    // Provenance for the untouched fields is preserved too, not reset to "transcript".
    expect(values.requirementSources.budget).toBe("agent");
    expect(values.requirementSources.sharing).toBe("agent");
    expect(values.requirementSources.university).toBe("transcript");
  });

  it("with no prior Discovery at all, an unsupported field falls back to an honest empty string, never a fabricated value", () => {
    const values = extractionToFormValues(makeExtraction({ university: "UCL" }), null);
    expect(values.budgetMin).toBe("");
    expect(values.sharing).toBe("");
    expect(values.requirementSources.budget).toBeNull();
  });

  it("a new university text drops the OLD resolved snapshot (it no longer matches), but keeps it when university itself falls back to the existing value", () => {
    const discovery = makeDiscovery({
      student: { university: "University of Hertfordshire", universityResolved: { id: "1", name: "University of Hertfordshire", city: "Hatfield", country: "UK", latitude: 1, longitude: 1 }, course: null, intake: null },
    });
    expect(extractionToFormValues(makeExtraction({ university: "UCL" }), discovery).universityResolved).toBeNull();
    expect(extractionToFormValues(makeExtraction(), discovery).universityResolved?.name).toBe("University of Hertfordshire");
  });

  it("priorities fall back to Discovery's existing set when the transcript found none", () => {
    const discovery = makeDiscovery({ priorities: ["budget", "location"] });
    expect(extractionToFormValues(makeExtraction({ priorities: [] }), discovery).priorities).toEqual(["budget", "location"]);
    expect(extractionToFormValues(makeExtraction({ priorities: ["distance"] }), discovery).priorities).toEqual(["distance"]);
  });
});
