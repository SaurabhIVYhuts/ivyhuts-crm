"use client";

import { Check } from "lucide-react";
import type { LeadDetail } from "@/types/lead";

// A derived VISUALIZATION only. `Lead.status` remains the one authoritative
// lifecycle field (see api/_lib/models/Lead.js) — this component introduces
// no new status/stage enum anywhere, in the database or otherwise. Every
// stage below is computed from data that already happened
// (LeadDetail.journey, itself computed server-side from real Meeting/
// Discovery/AccommodationCuration/Presentation/Communication/FollowUp
// records — see api/leads/[id].js's buildJourneyFlags) or from
// `lead.status` directly. Nothing here is inferred from "the section was
// opened" or any other proxy for actual progress.
export interface Stage {
  id: string;
  label: string;
  complete: boolean;
  // Section anchor id to scroll to (see page.tsx's <Section id="...">) —
  // undefined for stages with no corresponding section (Lead itself).
  anchor?: string;
  subLabel?: string;
}

// Milestone 23.11 — buildJourneyFlags is now real (confirmed by direct
// inspection of api/leads/[id].js before this milestone; it previously
// didn't exist — see the Milestone 23.6/23.9 reports for that history).
// This default is now purely a defensive fallback for an unexpected
// malformed response, not a standing crash guard for a known-dead backend
// field.
const EMPTY_JOURNEY: LeadDetail["journey"] = {
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

// Exported for direct unit testing (src/components/leads/__tests__/
// salesJourney.test.ts) — this repo has no jsdom/React Testing Library
// setup (vitest.config.ts runs a plain "node" environment), so this pure
// derivation logic is tested directly rather than via component rendering.
export function buildStages(lead: LeadDetail): Stage[] {
  const j = lead.journey ?? EMPTY_JOURNEY;
  return [
    // Always complete — true for every Lead this page can even render.
    { id: "lead", label: "Lead", complete: true },
    { id: "assigned", label: "Assigned", complete: j.hasAssignment, anchor: "lead-information" },
    // A Lead being created is not the same event as the customer actually
    // being contacted. Driven by a real outbound Communication, not
    // Lead.createdAt/firstContactAt.
    { id: "contact", label: "Contacted", complete: j.hasOutboundCommunication, anchor: "communications" },
    // A meeting is an OPTIONAL enhancement to Discovery, never a
    // prerequisite (Milestone 23.9/23.10/23.11's core architecture rule) —
    // a lead can reach every later stage with this one incomplete, and
    // computeCurrentIndex below already treats that as "no ambiguous
    // current stage" rather than a blocker. Requires an actually
    // COMPLETED meeting, not merely a scheduled one.
    { id: "meeting", label: "Meeting", complete: j.hasCompletedMeeting, anchor: "meeting" },
    // Requires EXPLICITLY confirmed university/budget/currency/sharing on
    // Discovery — stricter than Find Rooms' own gate, which also tolerates
    // a roomPreference-derived guess pending confirmation. See
    // src/types/lead.ts's LeadJourneyFlags comment. Milestone 23.15 — while
    // still incomplete, the sublabel surfaces a pending transcript
    // suggestion the same way the followUp stage already distinguishes
    // "Scheduled" vs "Completed" — a real signal, not a fabricated one:
    // once hasConfirmedRequirements flips true, this stage is complete and
    // the badge no longer applies regardless of the meeting's own state.
    {
      id: "requirements",
      label: "Requirements Understood",
      complete: j.hasConfirmedRequirements,
      anchor: "discovery",
      subLabel: !j.hasConfirmedRequirements && j.hasPendingTranscriptReview ? "Suggestion ready" : undefined,
    },
    // Find Rooms search requests are never persisted (a stateless query —
    // see api/properties/search.js), so there is no independent evidence
    // of "rooms were searched" separate from a saved, non-empty curated
    // shortlist. This stage represents both together, honestly.
    { id: "curated", label: "Rooms Searched & Curated", complete: j.hasCuratedProperties, anchor: "find-rooms" },
    // Only a READY presentation counts — GENERATING/FAILED never do. This
    // means "generated", not "the customer received it" — nothing in this
    // system records a send-confirmation event.
    { id: "presentation", label: "Presentation Generated", complete: j.hasReadyPresentation, anchor: "presentation" },
    // At least one meaningful FollowUp, pending or completed — the
    // sub-label distinguishes "still scheduled" from "done, nothing
    // pending right now", without that distinction affecting whether the
    // stage itself reads as complete.
    {
      id: "followUp",
      label: "Follow-up",
      complete: j.hasAnyFollowUp,
      anchor: "follow-ups",
      subLabel: j.hasAnyFollowUp ? (j.hasPendingFollowUp ? "Scheduled" : "Completed") : undefined,
    },
    // The existing Lead.status enum, not a fabricated conversion event.
    { id: "conversion", label: "Conversion", complete: lead.status === "converted", anchor: "lead-information" },
  ];
}

// The "current" stage is the first incomplete one — but ONLY when every
// stage before it is complete and every stage after it is still incomplete
// too. Real Lead data doesn't always progress in a strict line (e.g. an
// agent can generate a Presentation before ever logging a Communication
// through this CRM), and highlighting a single "current" stage in that case
// would imply an order that didn't actually happen. Spec §25: "if
// determining a unique current stage becomes ambiguous, simply show
// completion states without inventing a current stage."
export function computeCurrentIndex(stages: Stage[]): number | null {
  let prefixEnd = 0;
  while (prefixEnd < stages.length && stages[prefixEnd].complete) prefixEnd++;
  if (prefixEnd >= stages.length) return null;
  const hasLaterCompletion = stages.slice(prefixEnd + 1).some((s) => s.complete);
  if (hasLaterCompletion) return null;
  return prefixEnd;
}

function scrollToAnchor(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Milestone 23.12 Part 6 — "the Lead Detail page should clearly expose
// CURRENT STAGE / NEXT ACTION / WHY". Derived from the SAME buildStages
// sequence the pills above already render — never a second, independently-
// hardcoded next-action rule per lead. The rule is deliberately simple and
// documented here: the next action is whatever the FIRST incomplete stage
// in canonical order is. This does NOT special-case "skip the optional
// Meeting stage if a later one is already complete" — every worked example
// in the milestone brief is satisfied by the plain first-incomplete rule,
// and adding skip-logic on top would trade a simple, auditable rule for a
// speculative one nothing in the brief actually required.
export interface NextAction {
  stageId: string;
  label: string;
  description: string;
  anchor?: string;
}

const NEXT_ACTION_COPY: Record<string, { label: string; description: string }> = {
  assigned: { label: "Assign this lead", description: "No agent is assigned yet." },
  contact: { label: "Contact the student", description: "This lead hasn't been contacted yet." },
  meeting: { label: "Schedule a meeting", description: "Optional — helps confirm requirements faster, but Discovery can proceed without one." },
  requirements: { label: "Confirm requirements", description: "University, budget, and sharing still need to be confirmed in Discovery." },
  curated: { label: "Find and curate accommodation", description: "Requirements are confirmed — search Find Rooms and save a shortlist." },
  presentation: { label: "Generate a presentation", description: "A curated shortlist is saved — generate a presentation to share with the student." },
  followUp: { label: "Follow up with the student", description: "A presentation has been generated — record contact and schedule the next follow-up." },
  conversion: { label: "Decide: converted or lost", description: "Everything else is done — update this lead's status once the outcome is known." },
};

// Milestone 23.15 — the requirements stage's ONE dynamic copy override: when
// a transcript suggestion is sitting there waiting, "confirm requirements"
// undersells what's actually available (a specific, one-click-away
// suggestion) — this is real information already computed server-side
// (journey.hasPendingTranscriptReview), not a fabricated affordance. Every
// other stage keeps its plain static copy; this is not a second rules
// engine, just the one place real data makes the generic copy misleading.
const REQUIREMENTS_TRANSCRIPT_REVIEW_COPY = {
  label: "Review AI-suggested requirements",
  description: "A meeting transcript produced suggested requirements — review and confirm them in Discovery.",
};

export function deriveNextAction(lead: LeadDetail): NextAction | null {
  // Terminal states have no "next action" — StatusBadge already shows the
  // real outcome; inventing a CTA on a closed lead would be dishonest.
  if (lead.status === "converted" || lead.status === "lost") return null;
  const firstIncomplete = buildStages(lead).find((s) => !s.complete);
  if (!firstIncomplete) return null;
  const copy =
    firstIncomplete.id === "requirements" && lead.journey.hasPendingTranscriptReview
      ? REQUIREMENTS_TRANSCRIPT_REVIEW_COPY
      : NEXT_ACTION_COPY[firstIncomplete.id];
  if (!copy) return null;
  return { stageId: firstIncomplete.id, anchor: firstIncomplete.anchor, ...copy };
}

// One or two contextual shortcut buttons per stage — every one just scrolls
// to the section that already has the real form/action (no duplicated
// forms, no new modals). Some stages offer two relevant next steps (e.g.
// "presentation generated" naturally leads to both recording contact AND
// scheduling the follow-up — Milestone 23.12 Part 8/9's own worked
// examples show exactly this pairing).
const NEXT_ACTION_BUTTONS: Record<string, Array<{ label: string; anchor: string }>> = {
  assigned: [{ label: "Assign Lead", anchor: "lead-information" }],
  contact: [{ label: "Record Communication", anchor: "communications" }],
  meeting: [{ label: "Schedule Meeting", anchor: "meeting" }],
  requirements: [{ label: "Open Discovery", anchor: "discovery" }],
  curated: [{ label: "Find Rooms", anchor: "find-rooms" }],
  presentation: [{ label: "Generate Presentation", anchor: "presentation" }],
  followUp: [
    { label: "Record Communication", anchor: "communications" },
    { label: "Create Follow-up", anchor: "follow-ups" },
  ],
  conversion: [{ label: "Update Status", anchor: "lead-information" }],
};

// Milestone 23.14 — when the canonical next action IS "follow up", show the
// specific earliest-pending follow-up's own detail (type/due/notes),
// exactly the richer information the now-removed, narrower NextActionCard
// used to provide — reusing lead.followUps (already loaded on LeadDetail,
// bounded/sorted ascending by dueAt server-side, see buildLeadDetail in
// api/leads/[id].js), so no second request and no second rule.
export function nextPendingFollowUp(lead: LeadDetail) {
  return lead.followUps.filter((f) => f.status === "pending").sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())[0] || null;
}

export function NextActionPanel({ lead }: { lead: LeadDetail }) {
  const action = deriveNextAction(lead);
  if (!action) {
    return (
      <div className="mt-3 rounded-lg bg-surface-2 px-3.5 py-2.5 text-sm text-subtle">
        {lead.status === "converted" ? "This lead has converted." : lead.status === "lost" ? "This lead was marked lost." : "Nothing further to do right now."}
      </div>
    );
  }
  const buttons = NEXT_ACTION_BUTTONS[action.stageId] || [];
  const followUp = action.stageId === "followUp" ? nextPendingFollowUp(lead) : null;
  const overdue = followUp ? new Date(followUp.dueAt).getTime() < new Date().getTime() : false;
  return (
    <div className="mt-3 rounded-lg border border-accent/20 bg-accent-soft px-3.5 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-accent-strong">
        Next Action {overdue && <span className="text-danger">· Overdue</span>}
      </div>
      <div className="mt-0.5 text-sm font-medium text-ink">{action.label}</div>
      <p className="mt-0.5 text-xs text-subtle">{action.description}</p>
      {followUp && (
        <p className={`mt-0.5 text-xs ${overdue ? "text-danger" : "text-subtle"}`}>
          {followUp.type} · due {new Date(followUp.dueAt).toLocaleString()}
          {followUp.notes ? ` — ${followUp.notes}` : ""}
        </p>
      )}
      {buttons.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {buttons.map((btn) => (
            <button
              key={btn.label}
              type="button"
              onClick={() => scrollToAnchor(btn.anchor)}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-strong"
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type VisualState = "complete" | "current" | "upcoming" | "terminated";

const STATE_STYLES: Record<VisualState, string> = {
  complete: "bg-success/10 text-success",
  current: "bg-accent/15 text-accent-strong ring-1 ring-inset ring-accent/30",
  upcoming: "text-faint",
  terminated: "text-faint line-through decoration-line",
};

export function SalesJourney({ lead }: { lead: LeadDetail }) {
  const stages = buildStages(lead);
  // A lost Lead won't progress further — later incomplete stages are shown
  // as terminated (visually distinct from "still upcoming"), never as a
  // fake completion. Not a new journey stage — "Lost" is Lead.status, shown
  // via the existing StatusBadge in the page header (spec §11).
  const isLost = lead.status === "lost";
  const currentIndex = isLost ? null : computeCurrentIndex(stages);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold text-ink">Sales Journey</h2>
        {/* Nurturing/Lost are lifecycle states, not journey stages — StatusBadge
            in the header already shows the real status; this is just context
            for why progress looks "stalled" here, not a second status control. */}
        {lead.status === "nurturing" && <span className="text-xs text-cyan-400">Nurturing — later stages remain open.</span>}
        {isLost && <span className="text-xs text-faint">Lead marked as lost.</span>}
      </div>

      <ol className="flex flex-wrap items-center gap-y-3">
        {stages.map((stage, i) => {
          const state: VisualState = stage.complete
            ? "complete"
            : isLost
              ? "terminated"
              : i === currentIndex
                ? "current"
                : "upcoming";
          const clickable = Boolean(stage.anchor) && (stage.complete || state === "current");

          return (
            <li key={stage.id} className="flex items-center">
              {i > 0 && (
                <span aria-hidden className={`mx-1 h-px w-6 shrink-0 sm:w-10 ${stages[i - 1].complete ? "bg-success/50" : "bg-line"}`} />
              )}
              <button
                type="button"
                disabled={!clickable}
                onClick={() => stage.anchor && scrollToAnchor(stage.anchor)}
                title={stage.anchor && clickable ? `Go to ${stage.label}` : undefined}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATE_STYLES[state]} ${
                  clickable ? "cursor-pointer hover:opacity-80" : "cursor-default"
                }`}
              >
                {state === "complete" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <span
                    aria-hidden
                    className={`inline-block h-2 w-2 rounded-full ${
                      state === "current" ? "bg-accent" : state === "terminated" ? "bg-line" : "border border-faint"
                    }`}
                  />
                )}
                <span>{stage.label}</span>
                {stage.subLabel && <span className="opacity-70">· {stage.subLabel}</span>}
              </button>
            </li>
          );
        })}
      </ol>

      <NextActionPanel lead={lead} />
    </div>
  );
}
