// Milestone 23.11 — Follow-up bucketing tests (overdue/today/upcoming/
// completed/cancelled). Pure logic only — see bucketOf's own export
// comment in FollowUpsSection.tsx for why (no jsdom in this repo).
import { describe, expect, it } from "vitest";
import { bucketOf } from "../FollowUpsSection";
import type { FollowUp } from "@/types/followUp";

function makeFollowUp(overrides: Partial<FollowUp> = {}): FollowUp {
  return {
    id: "fu1",
    leadId: "lead1",
    userId: null,
    assignedTo: null,
    type: "call",
    priority: "medium",
    dueAt: "2026-01-01T10:00:00.000Z",
    status: "pending",
    notes: null,
    completedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

describe("bucketOf — completed/cancelled always win regardless of due date", () => {
  it("a completed follow-up buckets as 'completed' even if its due date is in the future", () => {
    expect(bucketOf(makeFollowUp({ status: "completed", dueAt: daysFromNow(5) }))).toBe("completed");
  });
  it("a cancelled follow-up buckets as 'cancelled' even if it's overdue", () => {
    expect(bucketOf(makeFollowUp({ status: "cancelled", dueAt: daysFromNow(-5) }))).toBe("cancelled");
  });
});

describe("bucketOf — pending follow-ups bucket by due date", () => {
  it("overdue: due date is before today", () => {
    expect(bucketOf(makeFollowUp({ status: "pending", dueAt: daysFromNow(-2) }))).toBe("overdue");
  });
  it("today: due date is today, regardless of the exact time", () => {
    const today = new Date();
    today.setHours(23, 59, 0, 0);
    expect(bucketOf(makeFollowUp({ status: "pending", dueAt: today.toISOString() }))).toBe("today");
  });
  it("upcoming: due date is after today", () => {
    expect(bucketOf(makeFollowUp({ status: "pending", dueAt: daysFromNow(3) }))).toBe("upcoming");
  });
});
