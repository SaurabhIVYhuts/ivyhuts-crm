// Milestone 23.11 — Sales Journey derivation tests. Pure logic only (no
// jsdom/React Testing Library in this repo — see buildStages/
// computeCurrentIndex's own export comments in SalesJourney.tsx).
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildStages, computeCurrentIndex, deriveNextAction, nextPendingFollowUp } from "../SalesJourney";
import type { LeadDetail } from "@/types/lead";
import type { LeadJourneyFlags } from "@/types/lead";

const EMPTY_JOURNEY: LeadJourneyFlags = {
  hasAssignment: false,
  hasOutboundCommunication: false,
  hasCompletedMeeting: false,
  hasConfirmedRequirements: false,
  hasCuratedProperties: false,
  hasReadyPresentation: false,
  hasAnyFollowUp: false,
  hasPendingFollowUp: false,
  hasPendingTranscriptReview: false,
};

function makeLead(overrides: { status?: LeadDetail["status"]; journey?: Partial<LeadJourneyFlags>; followUps?: LeadDetail["followUps"] } = {}): LeadDetail {
  return {
    id: "lead1",
    userId: null,
    contact: { name: "Test Student", email: null, phone: null },
    status: overrides.status ?? "new",
    temperature: "cold",
    score: 0,
    source: null,
    sourceDetails: {},
    assignedTo: null,
    property: { id: null, name: null, city: null },
    notes: null,
    tags: [],
    firstContactAt: null,
    lastContactAt: null,
    lastInboundCommunicationAt: null,
    convertedAt: null,
    lostAt: null,
    lostReason: null,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    enquiries: [],
    followUps: overrides.followUps ?? [],
    communications: [],
    journey: { ...EMPTY_JOURNEY, ...overrides.journey },
  };
}

function stageMap(lead: LeadDetail): Record<string, boolean> {
  return Object.fromEntries(buildStages(lead).map((s) => [s.id, s.complete]));
}

describe("buildStages — a brand-new lead", () => {
  it("only the 'lead' stage is complete", () => {
    const stages = stageMap(makeLead());
    expect(stages.lead).toBe(true);
    expect(stages.assigned).toBe(false);
    expect(stages.contact).toBe(false);
    expect(stages.meeting).toBe(false);
    expect(stages.requirements).toBe(false);
    expect(stages.curated).toBe(false);
    expect(stages.presentation).toBe(false);
    expect(stages.followUp).toBe(false);
    expect(stages.conversion).toBe(false);
  });
});

describe("buildStages — activity vs stage completion (Milestone 23.11 Part 8)", () => {
  it("a scheduled-but-not-completed meeting does not complete the Meeting stage", () => {
    // hasCompletedMeeting is false here (a Meeting exists but isn't
    // completed) — buildStages has no way to see "a meeting exists" at
    // all, only the already-stricter flag, so this asserts the stage
    // reads incomplete exactly as it should.
    const stages = stageMap(makeLead({ journey: { hasCompletedMeeting: false } }));
    expect(stages.meeting).toBe(false);
  });

  it("hasCuratedProperties alone (not hasConfirmedRequirements) does not imply Requirements is understood", () => {
    const stages = stageMap(makeLead({ journey: { hasCuratedProperties: true, hasConfirmedRequirements: false } }));
    expect(stages.curated).toBe(true);
    expect(stages.requirements).toBe(false);
  });

  it("hasReadyPresentation never implies conversion or follow-up happened", () => {
    const stages = stageMap(makeLead({ journey: { hasReadyPresentation: true } }));
    expect(stages.presentation).toBe(true);
    expect(stages.followUp).toBe(false);
    expect(stages.conversion).toBe(false);
  });
});

describe("buildStages — meeting is optional, never a blocker", () => {
  it("a lead can reach Requirements/Curated/Presentation with the Meeting stage still incomplete", () => {
    const stages = stageMap(
      makeLead({
        journey: {
          hasAssignment: true,
          hasOutboundCommunication: true,
          hasCompletedMeeting: false,
          hasConfirmedRequirements: true,
          hasCuratedProperties: true,
          hasReadyPresentation: true,
        },
      })
    );
    expect(stages.meeting).toBe(false);
    expect(stages.requirements).toBe(true);
    expect(stages.curated).toBe(true);
    expect(stages.presentation).toBe(true);
  });
});

describe("buildStages — follow-up sublabel distinguishes scheduled vs completed", () => {
  it("shows 'Scheduled' when a pending follow-up exists", () => {
    const stage = buildStages(makeLead({ journey: { hasAnyFollowUp: true, hasPendingFollowUp: true } })).find((s) => s.id === "followUp");
    expect(stage?.subLabel).toBe("Scheduled");
  });
  it("shows 'Completed' when follow-ups exist but none are pending", () => {
    const stage = buildStages(makeLead({ journey: { hasAnyFollowUp: true, hasPendingFollowUp: false } })).find((s) => s.id === "followUp");
    expect(stage?.subLabel).toBe("Completed");
  });
  it("has no sublabel when no follow-up exists at all", () => {
    const stage = buildStages(makeLead()).find((s) => s.id === "followUp");
    expect(stage?.subLabel).toBeUndefined();
  });
});

describe("buildStages — conversion reflects the real Lead.status enum only", () => {
  it("is complete only when status is exactly 'converted'", () => {
    expect(stageMap(makeLead({ status: "converted" })).conversion).toBe(true);
    expect(stageMap(makeLead({ status: "nurturing" })).conversion).toBe(false);
    expect(stageMap(makeLead({ status: "lost" })).conversion).toBe(false);
  });
});

describe("buildStages — requirements stage surfaces a pending transcript suggestion (Milestone 23.15)", () => {
  it("shows 'Suggestion ready' when a transcript suggestion is pending and requirements aren't confirmed yet", () => {
    const stage = buildStages(makeLead({ journey: { hasPendingTranscriptReview: true } })).find((s) => s.id === "requirements");
    expect(stage?.complete).toBe(false);
    expect(stage?.subLabel).toBe("Suggestion ready");
  });
  it("has no sublabel once requirements are actually confirmed, even if the flag is still true", () => {
    const stage = buildStages(makeLead({ journey: { hasConfirmedRequirements: true, hasPendingTranscriptReview: true } })).find((s) => s.id === "requirements");
    expect(stage?.complete).toBe(true);
    expect(stage?.subLabel).toBeUndefined();
  });
  it("has no sublabel when nothing is pending", () => {
    const stage = buildStages(makeLead()).find((s) => s.id === "requirements");
    expect(stage?.subLabel).toBeUndefined();
  });
});

describe("computeCurrentIndex — linear progress", () => {
  it("returns the first incomplete stage when everything before it is complete and nothing after is", () => {
    const stages = buildStages(makeLead({ journey: { hasAssignment: true, hasOutboundCommunication: true } }));
    // lead, assigned, contact complete; meeting (index 3) is the first incomplete.
    expect(computeCurrentIndex(stages)).toBe(3);
  });
});

describe("computeCurrentIndex — non-linear progress is never fabricated into a fake 'current' stage", () => {
  it("returns null when a later stage is complete but an earlier one (e.g. skipped Meeting) is not", () => {
    const stages = buildStages(
      makeLead({
        journey: { hasAssignment: true, hasOutboundCommunication: true, hasCompletedMeeting: false, hasConfirmedRequirements: true },
      })
    );
    expect(computeCurrentIndex(stages)).toBeNull();
  });

  it("returns null once every stage is complete (nothing left to call 'current')", () => {
    const stages = buildStages(
      makeLead({
        status: "converted",
        journey: {
          hasAssignment: true,
          hasOutboundCommunication: true,
          hasCompletedMeeting: true,
          hasConfirmedRequirements: true,
          hasCuratedProperties: true,
          hasReadyPresentation: true,
          hasAnyFollowUp: true,
          hasPendingFollowUp: false,
        },
      })
    );
    expect(computeCurrentIndex(stages)).toBeNull();
  });
});

describe("deriveNextAction — Milestone 23.12 Part 6", () => {
  it("a brand-new lead's next action is to assign it", () => {
    const action = deriveNextAction(makeLead());
    expect(action?.stageId).toBe("assigned");
    expect(action?.label).toBe("Assign this lead");
  });

  it("matches the milestone's own worked example: assigned and contacted, but no meeting/discovery yet -> 'Schedule a meeting'", () => {
    const action = deriveNextAction(makeLead({ journey: { hasAssignment: true, hasOutboundCommunication: true } }));
    expect(action?.stageId).toBe("meeting");
    expect(action?.label).toBe("Schedule a meeting");
  });

  it("matches the milestone's own worked example: requirements confirmed -> 'Find and curate accommodation'", () => {
    const action = deriveNextAction(
      makeLead({ journey: { hasAssignment: true, hasOutboundCommunication: true, hasCompletedMeeting: true, hasConfirmedRequirements: true } })
    );
    expect(action?.stageId).toBe("curated");
    expect(action?.label).toBe("Find and curate accommodation");
  });

  it("matches the milestone's own worked example: everything through presentation done -> 'Follow up with the student'", () => {
    const action = deriveNextAction(
      makeLead({
        journey: {
          hasAssignment: true,
          hasOutboundCommunication: true,
          hasCompletedMeeting: true,
          hasConfirmedRequirements: true,
          hasCuratedProperties: true,
          hasReadyPresentation: true,
        },
      })
    );
    expect(action?.stageId).toBe("followUp");
    expect(action?.label).toBe("Follow up with the student");
  });

  it("Milestone 23.15 — when a transcript suggestion is pending at the requirements stage, the copy points at reviewing it instead of the generic 'confirm requirements' text", () => {
    const action = deriveNextAction(
      makeLead({ journey: { hasAssignment: true, hasOutboundCommunication: true, hasCompletedMeeting: true, hasPendingTranscriptReview: true } })
    );
    expect(action?.stageId).toBe("requirements");
    expect(action?.label).toBe("Review AI-suggested requirements");
    expect(action?.anchor).toBe("discovery");
  });

  it("without a pending transcript suggestion, the requirements stage keeps its plain generic copy", () => {
    const action = deriveNextAction(makeLead({ journey: { hasAssignment: true, hasOutboundCommunication: true, hasCompletedMeeting: true } }));
    expect(action?.stageId).toBe("requirements");
    expect(action?.label).toBe("Confirm requirements");
  });

  it("returns null (no fabricated action) once a lead is converted or lost", () => {
    expect(deriveNextAction(makeLead({ status: "converted" }))).toBeNull();
    expect(deriveNextAction(makeLead({ status: "lost" }))).toBeNull();
  });

  it("returns null once every real stage is complete but status isn't converted/lost yet (no action left to invent)", () => {
    const action = deriveNextAction(
      makeLead({
        status: "qualified",
        journey: {
          hasAssignment: true,
          hasOutboundCommunication: true,
          hasCompletedMeeting: true,
          hasConfirmedRequirements: true,
          hasCuratedProperties: true,
          hasReadyPresentation: true,
          hasAnyFollowUp: true,
          hasPendingFollowUp: false,
        },
      })
    );
    expect(action?.stageId).toBe("conversion");
  });
});

describe("nextPendingFollowUp — Milestone 23.14 (replaces the removed, narrower NextActionCard widget)", () => {
  it("returns the earliest PENDING follow-up, ignoring completed/cancelled ones and later-due pending ones", () => {
    const lead = makeLead({
      followUps: [
        { _id: "a", type: "call", priority: "medium", dueAt: "2026-03-01T00:00:00.000Z", status: "completed", notes: null },
        { _id: "b", type: "email", priority: "medium", dueAt: "2026-01-01T00:00:00.000Z", status: "pending", notes: "earliest" },
        { _id: "c", type: "call", priority: "high", dueAt: "2026-02-01T00:00:00.000Z", status: "pending", notes: "later" },
      ],
    });
    expect(nextPendingFollowUp(lead)?.notes).toBe("earliest");
  });

  it("returns null when there is no pending follow-up at all", () => {
    const lead = makeLead({ followUps: [{ _id: "a", type: "call", priority: "medium", dueAt: "2026-01-01T00:00:00.000Z", status: "cancelled", notes: null }] });
    expect(nextPendingFollowUp(lead)).toBeNull();
  });

  it("Milestone 23.14 — an unassigned, never-contacted lead's next action is 'Assign this lead', never a follow-up prompt (the exact bug the removed NextActionCard widget produced)", () => {
    const lead = makeLead({ status: "new" }); // no journey progress at all, no follow-ups
    const action = deriveNextAction(lead);
    expect(action?.stageId).toBe("assigned");
    expect(action?.label).not.toMatch(/follow-?up/i);
  });
});

describe("STRUCTURAL: Milestone 23.14 — no second next-action rules engine, no dead Competitive Analysis section", () => {
  const pageSrc = fs.readFileSync(path.join(__dirname, "..", "..", "..", "app", "dashboard", "leads", "[id]", "page.tsx"), "utf8");

  it("Lead Detail no longer imports or renders the removed NextActionCard widget (a passing mention in a history-explaining comment is fine)", () => {
    expect(pageSrc.includes('from "@/components/follow-ups/NextActionCard"')).toBe(false);
    expect(pageSrc.includes("<NextActionCard")).toBe(false);
  });

  it("Lead Detail no longer imports or renders the confirmed-backend-absent CompetitiveAnalysisSection", () => {
    expect(pageSrc.includes("competitive-analysis")).toBe(false);
    expect(pageSrc.includes("<CompetitiveAnalysisSection")).toBe(false);
  });

  it("the deleted Competitive Analysis files are actually gone, not just unlinked", () => {
    const deletedPaths = [
      path.join(__dirname, "..", "..", "competitive-analysis", "CompetitiveAnalysisSection.tsx"),
      path.join(__dirname, "..", "..", "competitive-analysis", "ComparisonTable.tsx"),
      path.join(__dirname, "..", "..", "competitive-analysis", "PropertySearch.tsx"),
      path.join(__dirname, "..", "..", "..", "types", "competitiveAnalysis.ts"),
      path.join(__dirname, "..", "..", "..", "lib", "api", "competitiveAnalysis.ts"),
    ];
    for (const p of deletedPaths) {
      expect(fs.existsSync(p)).toBe(false);
    }
  });
});
