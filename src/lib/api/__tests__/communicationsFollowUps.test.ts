// Milestone 23.11 — structural source assertions for the Communication/
// FollowUp API clients and the components that use them: exact endpoint
// mapping, no Amber references, no fabricated WhatsApp success. Same "read
// the source, assert a pattern" convention as
// src/components/find-rooms/__tests__/structural.test.ts and
// src/components/meetings/__tests__/structural.test.ts (this repo has no
// jsdom/React Testing Library — see those files' own comments for why).
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC = path.join(__dirname, "..", "..", "..");

function read(relPath: string): string {
  return fs.readFileSync(path.join(SRC, relPath), "utf8");
}

describe("STRUCTURAL: Communication API client maps to the real backend contract", () => {
  const src = read("lib/api/communications.ts");
  it("list/create hit /api/leads/:id/communications", () => {
    expect(src).toContain("`/api/leads/${leadId}/communications`");
  });
  it("get/update hit /api/leads/:id/communications/:communicationId", () => {
    expect(src).toContain("`/api/leads/${leadId}/communications/${communicationId}`");
  });
  it("createCommunication POSTs, updateCommunication PATCHes", () => {
    expect(/createCommunication[\s\S]*?method:\s*"POST"/.test(src)).toBe(true);
    expect(/updateCommunication[\s\S]*?method:\s*"PATCH"/.test(src)).toBe(true);
  });
});

describe("STRUCTURAL: FollowUp API client maps to the real backend contract", () => {
  const src = read("lib/api/followUps.ts");
  it("list/create hit /api/leads/:id/follow-ups", () => {
    expect(src).toContain("`/api/leads/${leadId}/follow-ups`");
  });
  it("get/update hit /api/leads/:id/follow-ups/:followUpId", () => {
    expect(src).toContain("`/api/leads/${leadId}/follow-ups/${followUpId}`");
  });
  it("createFollowUp POSTs, updateFollowUp PATCHes", () => {
    expect(/createFollowUp[\s\S]*?method:\s*"POST"/.test(src)).toBe(true);
    expect(/updateFollowUp[\s\S]*?method:\s*"PATCH"/.test(src)).toBe(true);
  });
});

describe("STRUCTURAL: no Amber anywhere in the Communication/Follow-up/Journey workflow", () => {
  const AMBER_REFERENCE = /\bamber(?!-\d)/i;
  const files = [
    "lib/api/communications.ts",
    "lib/api/followUps.ts",
    "lib/api/whatsapp.ts",
    "types/communication.ts",
    "types/followUp.ts",
    "types/whatsapp.ts",
    "components/communications/CommunicationsSection.tsx",
    "components/communications/WhatsAppSendForm.tsx",
    "components/follow-ups/FollowUpsSection.tsx",
    "components/follow-ups/NextActionCard.tsx",
    "components/leads/SalesJourney.tsx",
    "components/dashboard/WorkQueueSections.tsx",
    "components/presentations/PresentationsSection.tsx",
    "types/workQueue.ts",
    "app/dashboard/page.tsx",
    "app/dashboard/leads/page.tsx",
  ];
  it.each(files)("%s has no Amber reference outside Tailwind amber-* classes", (relPath) => {
    expect(AMBER_REFERENCE.test(read(relPath))).toBe(false);
  });
});

describe("STRUCTURAL: WhatsApp send never fabricates success", () => {
  const src = read("components/communications/WhatsAppSendForm.tsx");

  it("onSent() is only ever called after sendWhatsAppMessage resolves, inside the try block", () => {
    const fnStart = src.indexOf("async function handleConfirmSend");
    const fnBody = src.slice(fnStart, src.indexOf("\n}", fnStart));
    const sendCallIndex = fnBody.indexOf("await sendWhatsAppMessage(");
    const onSentIndex = fnBody.indexOf("onSent();");
    expect(sendCallIndex).toBeGreaterThan(-1);
    expect(onSentIndex).toBeGreaterThan(sendCallIndex);
    // Never called from the catch block (a failure must never look like a send).
    const catchStart = fnBody.indexOf("} catch");
    expect(fnBody.indexOf("onSent();", catchStart)).toBe(-1);
  });

  it("a 503 response permanently disables the form for this page view (config-unavailable path), never silently retried as if configured", () => {
    expect(src).toContain("err.status === 503");
    expect(src).toContain("setConfigUnavailable(true)");
  });

  it("delivery-status claims (sent/delivered/read) are rendered only by CommunicationsSection's real status-badge switch, never fabricated inside the send form itself", () => {
    // WhatsAppSendForm has no delivery-status UI of its own — that only
    // ever comes from CommunicationsSection's whatsAppStatusBadge, which
    // switches on the real, backend-driven Communication.status field.
    const statusSrc = read("components/communications/CommunicationsSection.tsx");
    expect(statusSrc).toContain('case "sent":');
    expect(statusSrc).toContain('case "delivered":');
    expect(src.includes("statusBadge") || src.includes("whatsAppStatusBadge")).toBe(false);
  });
});

describe("STRUCTURAL: the WhatsApp backend stub never claims to send (Milestone 23.11)", () => {
  it("the fail-closed route always returns 503 and never creates a Communication or claims success", () => {
    const backendRoot = path.join(SRC, "..", "..", "Downloads", "IVYHUTS", "ivyhuts-website", "api", "leads", "[id]", "whatsapp", "messages.js");
    if (!fs.existsSync(backendRoot)) return; // backend repo not present in this checkout — nothing to assert
    const src = fs.readFileSync(backendRoot, "utf8");
    expect(src).toContain("res.status(503)");
    expect(src.includes("Communication.create")).toBe(false);
    expect(/res\.status\(200\)/.test(src)).toBe(false);
  });
});
