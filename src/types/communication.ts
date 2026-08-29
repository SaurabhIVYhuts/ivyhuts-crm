// Mirrors api/_lib/models/Communication.js and its toSafeCommunication
// projection in the ivyhuts-website backend. Enum values verified against
// that model — do not add values here the backend doesn't support. As of
// Milestone 23.11, api/leads/[id]/communications/index.js and
// .../[communicationId]/index.js are real, verified routes (not merely
// claimed by this file's comments, as a prior version of this file
// incorrectly did before that route existed).

export const COMMUNICATION_CHANNELS = ["email", "whatsapp", "phone", "sms", "system"] as const;
export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[number];

export const COMMUNICATION_DIRECTIONS = ["inbound", "outbound"] as const;
export type CommunicationDirection = (typeof COMMUNICATION_DIRECTIONS)[number];

export interface Communication {
  id: string;
  leadId: string;
  userId: string | null;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  // Free-form categorization, not a closed enum. "video_call" is how a
  // video call is distinguished from a regular call within channel="phone"
  // — the backend has no dedicated video-call channel value.
  type: string;
  content: string | null;
  status: string | null;
  agentId: string | null;
  createdAt: string;
  updatedAt: string;
}

// Body for POST /api/leads/:id/communications — agentId/userId are never
// sent; the backend derives them from the session and the Lead itself.
export interface CommunicationInput {
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  type?: string;
  content?: string | null;
}

// Body for PATCH /api/leads/:id/communications/:communicationId — corrects
// a previously-logged entry. agentId is never editable here (see that
// route's own comment: who the interaction was logged by/with is an
// immutable fact of the record).
export interface UpdateCommunicationInput {
  channel?: CommunicationChannel;
  direction?: CommunicationDirection;
  type?: string;
  content?: string | null;
  status?: string | null;
}
