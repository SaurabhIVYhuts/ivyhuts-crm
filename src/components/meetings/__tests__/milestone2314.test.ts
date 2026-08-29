// Structural source assertions for the Milestone 23.14 additions (Google
// Meet link, transcript text, AI extraction, Agent Review panel,
// notifications) — same "read the source, assert a pattern" convention as
// structural.test.ts above. No jsdom/RTL in this repo (see that file's own
// header comment), so these are the closest honest substitute to a
// component-rendering test.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { MEETING_PROVIDERS, EXTRACTION_STATUSES } from "@/types/meeting";
import { NOTIFICATION_TYPES } from "@/types/notification";

const MEETINGS_DIR = path.join(__dirname, "..");
const DISCOVERY_DIR = path.join(MEETINGS_DIR, "..", "discovery");
const NOTIFICATIONS_DIR = path.join(MEETINGS_DIR, "..", "notifications");

function read(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

describe("STRUCTURAL: no fabricated Meet/extraction state", () => {
  it("MeetingsSection never hardcodes meetingUrl to a literal — only a real backend response can set it", () => {
    const src = read(path.join(MEETINGS_DIR, "MeetingsSection.tsx"));
    expect(/meetingUrl\s*[:=]\s*["'](?!.*\$\{)/.test(src)).toBe(false);
  });

  it("a newly scheduled meeting's POST body still carries only scheduledAt/notes — provider fields are never client-supplied", () => {
    const src = read(path.join(MEETINGS_DIR, "MeetingsSection.tsx"));
    const createCallMatch = src.match(/createMeeting\(leadId,\s*\{([^}]*)\}/);
    expect(createCallMatch).not.toBeNull();
    const createBody = createCallMatch![1];
    expect(createBody.includes("provider")).toBe(false);
    expect(createBody.includes("meetingUrl")).toBe(false);
  });

  it("extraction is only ever triggered via the real extractMeetingRequirements API call, never a hardcoded suggestion", () => {
    const src = read(path.join(MEETINGS_DIR, "MeetingsSection.tsx"));
    expect(src.includes("extractMeetingRequirements(meeting.leadId, meeting.id)")).toBe(true);
    // No object literal anywhere assigns a fabricated extractedRequirements
    // value — the only occurrences are type references / property reads.
    expect(/extractedRequirements\s*[:=]\s*\{/.test(src)).toBe(false);
  });
});

describe("STRUCTURAL: Discovery is the only write path — the review panel never bypasses it", () => {
  it("DiscoverySection's Confirm-All path calls the real saveDiscovery, never a Meeting-side write", () => {
    const src = read(path.join(DISCOVERY_DIR, "DiscoverySection.tsx"));
    expect(src.includes("await saveDiscovery(leadId, extractionToPayload(reviewMeeting.extractedRequirements))")).toBe(true);
  });

  it("confirming a suggestion always tags requirementSources as transcript, never silently defaulting to agent/lead_form", () => {
    const src = read(path.join(DISCOVERY_DIR, "DiscoverySection.tsx"));
    const fnMatch = src.match(/function extractionToPayload[\s\S]*?\n\}/);
    expect(fnMatch).not.toBeNull();
    // Milestone 23.16 — every requirementSources.<field> assignment inside
    // extractionToPayload is conditional (only when the transcript actually
    // supported that field — see touchedByExtraction), but whenever one IS
    // made, it must always be the literal "transcript", never any other
    // source value. At least one such assignment must exist.
    const assignments = [...fnMatch![0].matchAll(/requirementSources\.\w+\s*=\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(assignments.length).toBeGreaterThan(0);
    expect(assignments.every((v) => v === "transcript")).toBe(true);
  });

  it("Milestone 23.16 — extractionToPayload never sends a field the transcript left unsupported (omitted, not null), so the backend's partial merge can't silently clear an already-confirmed value", () => {
    const src = read(path.join(DISCOVERY_DIR, "DiscoverySection.tsx"));
    const fnMatch = src.match(/function extractionToPayload[\s\S]*?\n\}/);
    expect(fnMatch).not.toBeNull();
    // The old, buggy shape unconditionally built `accommodation: { budgetMin: extracted.budgetMin, ... }`
    // regardless of whether each field was null — that exact object-literal
    // pattern must not reappear.
    expect(/accommodation:\s*\{\s*budgetMin:\s*extracted\.budgetMin,/.test(fnMatch![0])).toBe(false);
  });

  it("a plain 'Edit Discovery' (not Review & Edit) never marks a pending suggestion reviewed as a side effect", () => {
    const src = read(path.join(DISCOVERY_DIR, "DiscoverySection.tsx"));
    const fnMatch = src.match(/function startEditing\(\)[\s\S]*?\n  \}/);
    expect(fnMatch).not.toBeNull();
    expect(fnMatch![0].includes("setIsReviewingSuggestion(false)")).toBe(true);
  });
});

describe("STRUCTURAL: notifications stay internal-CRM only", () => {
  it("NotificationBell never calls the browser Notification API or requests push permission", () => {
    const src = read(path.join(NOTIFICATIONS_DIR, "NotificationBell.tsx"));
    expect(/new Notification\(/.test(src)).toBe(false);
    expect(src.includes("requestPermission")).toBe(false);
    expect(src.includes("serviceWorker")).toBe(false);
  });

  it("the Header only renders the bell for an internal role", () => {
    const src = read(path.join(MEETINGS_DIR, "..", "layout", "Header.tsx"));
    expect(src.includes("hasInternalRole && <NotificationBell")).toBe(true);
  });
});

describe("STRUCTURAL: enums stay in sync with the real backend model", () => {
  it("MEETING_PROVIDERS is exactly google_meet", () => {
    expect([...MEETING_PROVIDERS]).toEqual(["google_meet"]);
  });
  it("EXTRACTION_STATUSES is exactly pending_review/reviewed", () => {
    expect([...EXTRACTION_STATUSES].sort()).toEqual(["pending_review", "reviewed"]);
  });
  it("NOTIFICATION_TYPES is exactly LEAD_ASSIGNED/TRANSCRIPT_READY_FOR_REVIEW/MEETING_SCHEDULED/MEETING_RESCHEDULED/MEETING_CANCELLED", () => {
    expect([...NOTIFICATION_TYPES].sort()).toEqual([
      "LEAD_ASSIGNED",
      "MEETING_CANCELLED",
      "MEETING_RESCHEDULED",
      "MEETING_SCHEDULED",
      "TRANSCRIPT_READY_FOR_REVIEW",
    ]);
  });
});
