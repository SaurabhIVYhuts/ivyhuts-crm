// Mirrors api/_lib/models/Meeting.js and its toSafeMeeting projection in
// the ivyhuts-website backend (Milestone 23.10, extended Milestone 23.14).
// Field set verified directly against api/leads/[id]/meetings/index.js and
// .../[meetingId]/index.js.
//
// A Meeting stores MEETING information only — status, timing, and
// recording/transcript STATE. It never duplicates Discovery's
// university/budget/sharing fields; extractedRequirements below is a
// meeting-scoped SUGGESTION only, never written into Discovery
// automatically — an agent must explicitly confirm it via
// PUT /api/leads/:id/discovery (see src/types/discovery.ts's
// requirementSources) before it becomes real. Discovery remains the sole
// source of truth for confirmed requirements.
//
// recordingUrl/transcriptReference stay opaque strings an agent enters
// manually — no recording provider is integrated. meetingUrl IS a real
// integration (Google Meet, via a service-account-backed provider on the
// backend) but stays null/honest whenever that provider isn't configured
// for this deployment — never fabricated.

export const MEETING_STATUSES = ["scheduled", "completed", "cancelled"] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

// "none" = no recording/transcript expected yet; "pending" = expected but
// not yet available; "available" = an agent has attached a real reference.
export const MEDIA_STATUSES = ["none", "pending", "available"] as const;
export type MediaStatus = (typeof MEDIA_STATUSES)[number];

// Milestone 23.14 — the only meeting provider integrated. null means no
// provider was configured/succeeded when this meeting was scheduled.
export const MEETING_PROVIDERS = ["google_meet"] as const;
export type MeetingProvider = (typeof MEETING_PROVIDERS)[number];

export const EXTRACTION_STATUSES = ["pending_review", "reviewed"] as const;
export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number];

// AI-assisted, transcript-derived SUGGESTION — mirrors Discovery's own
// student/accommodation shape field-for-field so the Agent Review UI can
// present it as "what Discovery would become if confirmed as-is". Every
// field the transcript didn't explicitly support stays null — never
// guessed (see the backend's api/_lib/transcriptExtraction.js).
export interface ExtractedRequirements {
  status: ExtractionStatus;
  extractedAt: string;
  university: string | null;
  course: string | null;
  intake: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string | null;
  moveInDate: string | null;
  stayDurationMonths: number | null;
  preferredLocation: string | null;
  roomPreference: string | null;
  sharing: number | null;
  distancePreference: string | null;
  priorities: string[];
  notes: string | null;
}

export interface Meeting {
  id: string;
  leadId: string;
  status: MeetingStatus;
  scheduledAt: string;
  completedAt: string | null;
  provider: MeetingProvider | null;
  providerMeetingId: string | null;
  meetingUrl: string | null;
  recordingStatus: MediaStatus;
  recordingUrl: string | null;
  transcriptStatus: MediaStatus;
  transcriptReference: string | null;
  transcriptText: string | null;
  extractedRequirements: ExtractedRequirements | null;
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// Body for POST /api/leads/:id/meetings.
export interface CreateMeetingInput {
  scheduledAt: string;
  notes?: string | null;
}

// Body for PATCH /api/leads/:id/meetings/:meetingId — every field optional,
// full replace of whichever fields are present (NOT a dot-path partial like
// Discovery — Meeting has no nested sub-object, so a flat partial is
// unambiguous). recordingUrl/transcriptReference are validated together
// with their *Status sibling server-side: required (non-empty) exactly
// when that status is "available", required null otherwise.
//
// markExtractedRequirementsReviewed is a one-way action, not a raw status
// setter: it's the second half of "Confirm All"/"Review & Edit" in the
// Agent Review UI, called alongside (never instead of) the real
// PUT /discovery confirmation — see src/components/discovery's review panel.
export interface UpdateMeetingInput {
  status?: MeetingStatus;
  scheduledAt?: string;
  notes?: string | null;
  recordingStatus?: MediaStatus;
  recordingUrl?: string | null;
  transcriptStatus?: MediaStatus;
  transcriptReference?: string | null;
  transcriptText?: string | null;
  markExtractedRequirementsReviewed?: true;
}
