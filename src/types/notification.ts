// Mirrors api/_lib/models/Notification.js and its toSafeNotification
// projection in the ivyhuts-website backend (Milestone 23.14). Internal CRM
// notification only — never browser push, email, or WhatsApp. Field set
// verified directly against api/notifications/index.js and
// api/notifications/[id]/index.js.
//
// Always the authenticated session's own notifications — there is no
// cross-agent visibility and no client-supplied recipient.

export const NOTIFICATION_TYPES = [
  "LEAD_ASSIGNED",
  "TRANSCRIPT_READY_FOR_REVIEW",
  "MEETING_SCHEDULED",
  "MEETING_RESCHEDULED",
  "MEETING_CANCELLED",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface Notification {
  id: string;
  leadId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  actionHref: string | null;
  readAt: string | null;
  createdAt: string;
}
