// Mirrors api/_lib/models/Lead.js and api/_lib/leadView.js's `toSafeLead`
// projection in the ivyhuts-website backend. Field set verified against
// api/leads/index.js (create) and api/leads/[id].js (patch) — do not add
// fields here that aren't handled by those files.

// "nurturing" added in CRM Milestone 8 (mirrors the backend Lead.js enum
// change made that milestone) — a lead not ready to convert now but still
// a real prospect, distinct from "lost".
export const LEAD_STATUSES = ["new", "contacted", "qualified", "nurturing", "converted", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type LeadTemperature = "cold" | "warm" | "hot";

export interface LeadContact {
  name: string | null;
  email: string | null;
  phone: string | null;
}

export interface LeadProperty {
  id: string | null;
  name: string | null;
  city: string | null;
}

export interface Lead {
  id: string;
  userId: string | null;
  contact: LeadContact;
  status: LeadStatus;
  temperature: LeadTemperature;
  score: number;
  source: string | null;
  sourceDetails: Record<string, unknown>;
  assignedTo: string | null;
  property: LeadProperty;
  notes: string | null;
  tags: string[];
  firstContactAt: string | null;
  lastContactAt: string | null;
  // A real customer-initiated contact event, not a lifecycle status. When
  // this equals lastContactAt, the most recent contact event was itself
  // inbound — i.e. the customer's message is still awaiting an agent
  // response. Milestone 23.11: computed fresh on every read from the
  // Communication collection (never persisted, so it can't drift out of
  // sync) — see buildLeadDetail in api/leads/[id].js (GET /api/leads/:id)
  // and the separate aggregation in api/leads/work-queue.js. Populated on
  // those two responses only — plain GET /api/leads (list) does not
  // compute it, since neither LeadsTable.tsx nor any other list view reads
  // this field.
  lastInboundCommunicationAt: string | null;
  convertedAt: string | null;
  lostAt: string | null;
  lostReason: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Milestone 23.11 — real, server-computed signals (buildJourneyFlags in
// api/leads/[id].js), added to the SAME GET /api/leads/:id response rather
// than a new endpoint or new per-component fetches. Unlike `followUps`/
// `communications` below (bounded to the 10 most relevant, sorted by
// dueAt/recency), these flags check the full collection for this lead, so
// a heavily-worked lead with more than 10 follow-ups/communications still
// reports correctly. This is NOT a second Lead lifecycle field —
// `Lead.status` remains authoritative; see
// src/components/leads/SalesJourney.tsx for how these combine with
// `status` to derive the journey stages.
//
// Each flag is deliberately stricter than "does a related record exist"
// wherever activity != stage-completion (see the backend's own derivation
// comment): hasCompletedMeeting requires status="completed", not merely
// scheduled; hasConfirmedRequirements requires EXPLICIT university/budget/
// currency/sharing on Discovery (not the looser roomPreference-derived
// fallback Find Rooms itself tolerates); hasCuratedProperties requires a
// non-empty AccommodationCuration, not a saved-but-empty shortlist;
// hasReadyPresentation requires status="READY", never GENERATING/FAILED,
// and is never claimed to mean the customer received it.
export interface LeadJourneyFlags {
  hasAssignment: boolean;
  hasOutboundCommunication: boolean;
  hasCompletedMeeting: boolean;
  hasConfirmedRequirements: boolean;
  hasCuratedProperties: boolean;
  hasReadyPresentation: boolean;
  hasAnyFollowUp: boolean;
  hasPendingFollowUp: boolean;
  // Milestone 23.15 — true when at least one of this lead's meetings has an
  // AI transcript-extraction suggestion still awaiting agent review (same
  // rule as api/leads/work-queue.js's transcriptAvailableNeedsReview
  // bucket, just per-lead). SalesJourney uses this to tell "Confirm
  // requirements from scratch" apart from "a suggestion is ready to
  // review" — the requirements stage itself is unaffected; this never
  // implies hasConfirmedRequirements.
  hasPendingTranscriptReview: boolean;
}

// GET /api/leads/:id additionally embeds bounded, recent related records —
// see buildLeadDetail in api/leads/[id].js. Shapes here are the `.select()`
// projections that handler uses, not the full models.
export interface LeadDetail extends Lead {
  enquiries: Array<{
    _id: string;
    status: string;
    source: string | null;
    property: LeadProperty;
    contact: LeadContact;
    createdAt: string;
  }>;
  followUps: Array<{
    _id: string;
    type: string;
    priority: string;
    dueAt: string;
    status: string;
    notes: string | null;
  }>;
  communications: Array<{
    _id: string;
    channel: string;
    direction: string;
    type: string;
    status: string;
    createdAt: string;
  }>;
  journey: LeadJourneyFlags;
}
