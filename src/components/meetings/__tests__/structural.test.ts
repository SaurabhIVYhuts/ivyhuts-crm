// Structural source assertions for the Meetings workflow (Milestone
// 23.10) — same "read the source, assert a pattern" convention as
// src/components/find-rooms/__tests__/structural.test.ts. This repo has no
// jsdom/React Testing Library setup (vitest.config.ts runs a plain "node"
// environment, .test.ts only) — true component-rendering tests aren't
// possible without adding that infrastructure, which wasn't requested and
// would be a new dependency, not a test. These structural checks are the
// closest honest substitute: they verify the actual source never fabricates
// recording/transcript state and never references Amber, without rendering
// anything.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { MEETING_STATUSES, MEDIA_STATUSES } from "@/types/meeting";

const MEETINGS_DIR = path.join(__dirname, "..");

function read(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

function allSourceFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts"))
    .map((entry) => path.join(dir, entry.name));
}

describe("STRUCTURAL: no Amber in the Meetings workflow", () => {
  const AMBER_REFERENCE = /\bamber(?!-\d)/i;

  it("no Meetings component or lib file references the Amber integration", () => {
    const files = [
      ...allSourceFiles(MEETINGS_DIR),
      path.join(MEETINGS_DIR, "..", "..", "lib", "api", "meetings.ts"),
      path.join(MEETINGS_DIR, "..", "..", "types", "meeting.ts"),
    ];
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(AMBER_REFERENCE.test(read(file))).toBe(false);
    }
  });
});

describe("STRUCTURAL: no fabricated recording/transcript state", () => {
  it("MeetingsSection never hardcodes a media status to 'available' — only a real backend response can set it", () => {
    const src = read(path.join(MEETINGS_DIR, "MeetingsSection.tsx"));
    // The only literal occurrences of "available" allowed in this file are
    // inside MEDIA_LABELS (a display label) and the dropdown <option>
    // list/comparisons — never as a hardcoded initial/default value assigned
    // to a status field outside of user-driven state.
    const assignedToAvailable = /(?:recordingStatus|transcriptStatus)\s*[:=]\s*["']available["']/g;
    expect(src.match(assignedToAvailable)).toBeNull();
  });

  it("a newly scheduled meeting is never created with recording/transcript pre-populated client-side (POST body carries only scheduledAt/notes)", () => {
    const src = read(path.join(MEETINGS_DIR, "MeetingsSection.tsx"));
    const createCallMatch = src.match(/createMeeting\(leadId,\s*\{([^}]*)\}/);
    expect(createCallMatch).not.toBeNull();
    const createBody = createCallMatch![1];
    expect(createBody.includes("recordingStatus")).toBe(false);
    expect(createBody.includes("transcriptStatus")).toBe(false);
    expect(createBody.includes("recordingUrl")).toBe(false);
    expect(createBody.includes("transcriptReference")).toBe(false);
  });

  it("the 'transcript available' Discovery prompt is gated on a real transcriptStatus === 'available' check, never shown unconditionally", () => {
    const discoverySrc = read(path.join(MEETINGS_DIR, "..", "discovery", "DiscoverySection.tsx"));
    expect(discoverySrc.includes('m.transcriptStatus === "available"')).toBe(true);
  });
});

describe("STRUCTURAL: enums stay in sync with the real backend model", () => {
  it("MEETING_STATUSES is exactly scheduled/completed/cancelled", () => {
    expect([...MEETING_STATUSES].sort()).toEqual(["cancelled", "completed", "scheduled"]);
  });
  it("MEDIA_STATUSES is exactly none/pending/available", () => {
    expect([...MEDIA_STATUSES].sort()).toEqual(["available", "none", "pending"]);
  });
});
