// Milestone 23.12 — Work Queue priority derivation tests. Pure logic only
// (no jsdom in this repo — see other __tests__ files' own comments).
import { describe, expect, it } from "vitest";
import { derivePriorityQueue, isAwaitingReply, deriveAwaitingReplies } from "../WorkQueueSections";
import type { WorkQueueLead, WorkQueueBucket } from "@/types/workQueue";

function makeLead(overrides: Partial<WorkQueueLead> = {}): WorkQueueLead {
  return {
    id: overrides.id ?? "lead1",
    contact: { name: "Test Student", email: null, phone: null },
    status: "contacted",
    temperature: "cold",
    score: 0,
    source: null,
    assignedTo: null,
    property: { id: null, name: null, city: null },
    tags: [],
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    firstContactAt: null,
    lastContactAt: null,
    lastInboundCommunicationAt: null,
    nextFollowUp: null,
    nextMeeting: null,
    bucket: "noNextAction" as WorkQueueBucket,
    ...overrides,
  };
}

describe("isAwaitingReply / deriveAwaitingReplies", () => {
  it("is true only when lastInboundCommunicationAt equals lastContactAt", () => {
    const replied = makeLead({ lastContactAt: "2026-01-05T00:00:00.000Z", lastInboundCommunicationAt: "2026-01-05T00:00:00.000Z" });
    const answered = makeLead({ lastContactAt: "2026-01-06T00:00:00.000Z", lastInboundCommunicationAt: "2026-01-05T00:00:00.000Z" });
    expect(isAwaitingReply(replied)).toBe(true);
    expect(isAwaitingReply(answered)).toBe(false);
  });

  it("sorts by most recent reply first", () => {
    const older = makeLead({ id: "a", lastContactAt: "t", lastInboundCommunicationAt: "2026-01-01T00:00:00.000Z" });
    const newer = makeLead({ id: "b", lastContactAt: "t2", lastInboundCommunicationAt: "2026-01-05T00:00:00.000Z" });
    // Give each a distinct lastContactAt matching its own inbound time so isAwaitingReply is true for both.
    older.lastContactAt = older.lastInboundCommunicationAt;
    newer.lastContactAt = newer.lastInboundCommunicationAt;
    const result = deriveAwaitingReplies([older, newer]);
    expect(result.map((l) => l.id)).toEqual(["b", "a"]);
  });
});

describe("derivePriorityQueue — Milestone 23.12 priority order", () => {
  it("overdue beats every other bucket", () => {
    const overdue = makeLead({ id: "overdue", bucket: "overdue" });
    const meetingToday = makeLead({ id: "meeting", bucket: "meetingToday" });
    const result = derivePriorityQueue([meetingToday, overdue], 5);
    expect(result[0].lead.id).toBe("overdue");
    expect(result[0].reason).toBe("overdue");
  });

  it("meetingToday outranks a plain follow-up due today", () => {
    const today = makeLead({ id: "today", bucket: "today" });
    const meetingToday = makeLead({ id: "meeting", bucket: "meetingToday" });
    const result = derivePriorityQueue([today, meetingToday], 5);
    expect(result[0].lead.id).toBe("meeting");
    expect(result[0].reason).toBe("meetingToday");
  });

  it("the three new pipeline-gap buckets (discoveryIncomplete/readyForFindRooms/presentationNoFollowUp) are surfaced, in that order", () => {
    const presentationGap = makeLead({ id: "p", bucket: "presentationNoFollowUp" });
    const findRoomsGap = makeLead({ id: "f", bucket: "readyForFindRooms" });
    const discoveryGap = makeLead({ id: "d", bucket: "discoveryIncomplete" });
    const result = derivePriorityQueue([presentationGap, findRoomsGap, discoveryGap], 5);
    expect(result.map((r) => r.lead.id)).toEqual(["d", "f", "p"]);
    expect(result.map((r) => r.reason)).toEqual(["discoveryIncomplete", "readyForFindRooms", "presentationNoFollowUp"]);
  });

  it("a customer reply is treated as close to as urgent as overdue — ahead of meetingToday/today/new", () => {
    const replied = makeLead({ id: "replied", lastContactAt: "x", lastInboundCommunicationAt: "x", bucket: "noNextAction" });
    const meetingToday = makeLead({ id: "meeting", bucket: "meetingToday" });
    const result = derivePriorityQueue([meetingToday, replied], 5);
    expect(result[0].lead.id).toBe("replied");
  });

  it("never lists the same lead twice even if it would match multiple groups", () => {
    // A lead whose bucket is "overdue" would never also literally be
    // "replied" in the backend's own data, but this proves the de-dup
    // logic itself (seen-set) works regardless.
    const lead = makeLead({ id: "dup", bucket: "overdue", lastContactAt: "x", lastInboundCommunicationAt: "x" });
    const result = derivePriorityQueue([lead], 5);
    expect(result.filter((r) => r.lead.id === "dup").length).toBe(1);
  });

  it("respects the limit parameter", () => {
    const leads = Array.from({ length: 10 }, (_, i) => makeLead({ id: `lead-${i}`, bucket: "overdue" }));
    expect(derivePriorityQueue(leads, 3).length).toBe(3);
  });

  it("returns an empty list when nothing is actionable", () => {
    const quiet = makeLead({ bucket: "nurturing" });
    expect(derivePriorityQueue([quiet], 5)).toEqual([]);
  });
});
