// Small presentation helpers shared across dashboard/lead views. No
// business logic here — just turning real backend field values into
// readable text.

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// "contact_attempted" -> "Contact attempted". Works for any snake/camel
// backend enum value without a hardcoded label table, so it never falls
// out of sync with values the backend actually returns.
export function formatLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const withSpaces = value.replace(/[_-]+/g, " ");
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

// Originally private to NextActionCard.tsx (Milestone 8) — moved here in
// Milestone 11 so the Lead Inbox's Next Action column can show the same
// "Today"/"Tomorrow"/"Yesterday" relative labels instead of a second,
// possibly-drifting copy of this logic.
export function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function relativeDay(value: string): string {
  const due = new Date(value);
  const diffDays = Math.round((startOfDay(due) - startOfDay(new Date())) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  return formatDate(value);
}

// CRM Milestone 16 — "how long ago" phrasing for a PAST timestamp (a
// follow-up that's now overdue, a customer reply just received), as opposed
// to relativeDay's "which day" phrasing for an upcoming/due date. Added here
// rather than inline in a Dashboard component so both the Overdue and
// Recent Replies cards share one implementation (spec §27: "do not create
// another time-format implementation").
export function relativeTimeFromNow(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return formatDateTime(value); // a future timestamp — not this function's job, fall back plainly
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatDate(value);
}
