"use client";

// CRM Milestone 16 — Dashboard "Agent Command Center" sections built
// entirely from the ONE GET /api/leads/work-queue response the parent page
// already fetches (spec §5/§23: reuse the existing Work Queue, no request
// per card, no N+1). Every derivation function below only reads fields the
// backend already computed (`bucket`, `nextFollowUp`, `lastContactAt`,
// `lastInboundCommunicationAt`) — none of them re-implements the
// overdue/today/priority classification itself.
import type { ReactNode } from "react";
import Link from "next/link";
import { Phone, MessageCircle, CalendarClock, ArrowRight, Flame, Video, type LucideIcon } from "lucide-react";
import type { WorkQueueLead } from "@/types/workQueue";
import { NextActionCell } from "@/components/leads/LeadsTable";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { RowSkeleton } from "@/components/ui/Skeleton";
import type { ApiErrorState } from "@/lib/utils/errors";
import { relativeTimeFromNow } from "@/lib/utils/format";

// A customer reply the agent hasn't yet responded to — same convention as
// the Lead Detail page's own banner (src/app/dashboard/leads/[id]/page.tsx):
// the most recent contact event was itself inbound.
export function isAwaitingReply(lead: WorkQueueLead): boolean {
  return Boolean(lead.lastInboundCommunicationAt) && lead.lastInboundCommunicationAt === lead.lastContactAt;
}

export function deriveAwaitingReplies(leads: WorkQueueLead[]): WorkQueueLead[] {
  return leads
    .filter(isAwaitingReply)
    .sort((a, b) => new Date(b.lastInboundCommunicationAt as string).getTime() - new Date(a.lastInboundCommunicationAt as string).getTime());
}

// Combines overdue follow-ups, unanswered replies, today's meetings/
// follow-ups, brand-new leads, and (Milestone 23.12) the pipeline-gap
// signals the backend computes (discoveryIncomplete/readyForFindRooms) into
// one deterministic priority-ordered list — same priority order as
// BUCKET_SORT_RANK in api/leads/work-queue.js, with "replied" (a
// frontend-only signal — see isAwaitingReply — the backend has no bucket
// for it) slotted in right after overdue, matching this component's own
// pre-existing worked example. No AI, no scoring model: just the backend's
// own `bucket` field plus the one reply signal, merged and de-duplicated.
export interface PriorityItem {
  lead: WorkQueueLead;
  reason: "overdue" | "replied" | "meetingToday" | "today" | "new" | "discoveryIncomplete" | "readyForFindRooms";
}

export function derivePriorityQueue(leads: WorkQueueLead[], limit = 5): PriorityItem[] {
  const groups: Array<{ reason: PriorityItem["reason"]; items: WorkQueueLead[] }> = [
    { reason: "overdue", items: leads.filter((l) => l.bucket === "overdue") },
    { reason: "replied", items: deriveAwaitingReplies(leads) },
    { reason: "meetingToday", items: leads.filter((l) => l.bucket === "meetingToday") },
    { reason: "today", items: leads.filter((l) => l.bucket === "today") },
    { reason: "new", items: leads.filter((l) => l.bucket === "new") },
    { reason: "discoveryIncomplete", items: leads.filter((l) => l.bucket === "discoveryIncomplete") },
    { reason: "readyForFindRooms", items: leads.filter((l) => l.bucket === "readyForFindRooms") },
  ];

  const seen = new Set<string>();
  const result: PriorityItem[] = [];
  for (const group of groups) {
    for (const lead of group.items) {
      if (seen.has(lead.id) || result.length >= limit) continue;
      seen.add(lead.id);
      result.push({ lead, reason: group.reason });
    }
    if (result.length >= limit) break;
  }
  return result;
}

function reasonLabel(item: PriorityItem): { label: string; time: string } {
  switch (item.reason) {
    case "overdue":
      return { label: "Follow-up overdue", time: item.lead.nextFollowUp ? relativeTimeFromNow(item.lead.nextFollowUp.dueAt) : "—" };
    case "replied":
      return { label: "Customer replied", time: relativeTimeFromNow(item.lead.lastInboundCommunicationAt) };
    case "meetingToday":
      return { label: "Meeting today", time: item.lead.nextMeeting ? relativeTimeFromNow(item.lead.nextMeeting.scheduledAt) : "—" };
    case "today":
      return { label: "Follow-up today", time: item.lead.nextFollowUp ? relativeTimeFromNow(item.lead.nextFollowUp.dueAt) : "—" };
    case "new":
      return { label: "New lead", time: "—" };
    case "discoveryIncomplete":
      return { label: "Requirements not confirmed", time: "—" };
    case "readyForFindRooms":
      return { label: "Ready for Find Rooms", time: "—" };
  }
}

// Generic card shell shared by every section below — one place for the
// loading/error(+retry)/empty visual language.
export function DashboardCard({
  title,
  icon: Icon,
  viewAllHref,
  isLoading,
  error,
  onRetry,
  isEmpty,
  emptyTitle,
  emptyDescription,
  children,
}: {
  title: string;
  icon: LucideIcon;
  viewAllHref?: string;
  isLoading: boolean;
  error: ApiErrorState | null;
  onRetry?: () => void;
  isEmpty: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  children: ReactNode;
}) {
  return (
    <Card padded={false}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Icon className="h-4 w-4 text-faint" />
          {title}
        </h2>
        {viewAllHref && (
          <Link href={viewAllHref} className="text-xs font-medium text-accent-strong hover:underline">
            View all
          </Link>
        )}
      </div>
      <div className="p-2">
        {isLoading ? (
          <div className="flex flex-col divide-y divide-line-soft px-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <RowSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="p-2">
            <ErrorState error={error} onRetry={onRetry} />
          </div>
        ) : isEmpty ? (
          <EmptyState compact icon={Icon} title={emptyTitle} description={emptyDescription} />
        ) : (
          children
        )}
      </div>
    </Card>
  );
}

function QuickActions({ lead }: { lead: WorkQueueLead }) {
  const phone = lead.contact.phone;
  return (
    <div className="flex shrink-0 items-center gap-1">
      {phone && (
        <a
          href={`tel:${phone}`}
          onClick={(e) => e.stopPropagation()}
          title="Call"
          className="rounded-md p-1.5 text-faint hover:bg-surface-2 hover:text-ink"
        >
          <Phone className="h-3.5 w-3.5" />
        </a>
      )}
      {phone && (
        <Link
          href={`/dashboard/leads/${lead.id}#communications`}
          onClick={(e) => e.stopPropagation()}
          title="WhatsApp"
          className="rounded-md p-1.5 text-faint hover:bg-surface-2 hover:text-ink"
        >
          <MessageCircle className="h-3.5 w-3.5" />
        </Link>
      )}
      <Link
        href={`/dashboard/leads/${lead.id}#follow-ups`}
        onClick={(e) => e.stopPropagation()}
        title="Schedule Follow-up"
        className="rounded-md p-1.5 text-faint hover:bg-surface-2 hover:text-ink"
      >
        <CalendarClock className="h-3.5 w-3.5" />
      </Link>
      <Link
        href={`/dashboard/leads/${lead.id}`}
        onClick={(e) => e.stopPropagation()}
        title="Open Lead"
        className="rounded-md p-1.5 text-faint hover:bg-surface-2 hover:text-ink"
      >
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

export function PriorityQueueSection({
  leads,
  isLoading,
  error,
  onRetry,
}: {
  leads: WorkQueueLead[];
  isLoading: boolean;
  error: ApiErrorState | null;
  onRetry?: () => void;
}) {
  const items = derivePriorityQueue(leads);
  return (
    <DashboardCard
      title="Priority Queue"
      icon={Flame}
      viewAllHref="/dashboard/leads"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={items.length === 0}
      emptyTitle="You're all caught up."
      emptyDescription="No overdue work, unanswered replies, or new leads right now."
    >
      <ul className="flex flex-col">
        {items.map((item) => {
          const { label, time } = reasonLabel(item);
          return (
            <li key={item.lead.id}>
              {/* A plain flex row, NOT an <a> — QuickActions below renders its
                  own <a>/<Link> elements (tel:, Open Lead, ...), and HTML
                  forbids nesting <a> inside <a> (it silently corrupts the DOM
                  and breaks hydration). The lead name is its own Link instead. */}
              <div className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-surface-hover">
                <Avatar name={item.lead.contact.name} size="sm" />
                <Link href={`/dashboard/leads/${item.lead.id}`} className="min-w-0 flex-1">
                  <div className="truncate font-medium text-ink">
                    {item.lead.contact.name || item.lead.contact.email || "Unnamed lead"}
                  </div>
                  <div className={`text-xs ${item.reason === "overdue" ? "text-danger" : "text-subtle"}`}>
                    {label} · {time}
                  </div>
                </Link>
                <QuickActions lead={item.lead} />
              </div>
            </li>
          );
        })}
      </ul>
    </DashboardCard>
  );
}

// One chronological agenda for the day — meetings happening today, follow-
// ups due today, and overdue follow-ups, all merged and sorted by time.
// Replaces the former three separate cards (MeetingTodayCard /
// TodaysFollowUpsCard / OverdueCard, CRM plan item 6): same backend
// buckets, one list, so an agent reads the day in order instead of
// re-scanning three boxes of the same data.
export type AgendaEntry =
  | { kind: "meeting"; lead: WorkQueueLead; at: string }
  | { kind: "followup"; lead: WorkQueueLead; at: string; overdue: boolean };

export function deriveTodayAgenda(leads: WorkQueueLead[]): AgendaEntry[] {
  const entries: AgendaEntry[] = [];
  for (const lead of leads) {
    if (lead.bucket === "meetingToday" && lead.nextMeeting) {
      entries.push({ kind: "meeting", lead, at: lead.nextMeeting.scheduledAt });
    } else if ((lead.bucket === "today" || lead.bucket === "overdue") && lead.nextFollowUp) {
      entries.push({ kind: "followup", lead, at: lead.nextFollowUp.dueAt, overdue: lead.bucket === "overdue" });
    }
  }
  return entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export function TodayAgendaCard({
  leads,
  isLoading,
  error,
  onRetry,
}: {
  leads: WorkQueueLead[];
  isLoading: boolean;
  error: ApiErrorState | null;
  onRetry?: () => void;
}) {
  const entries = deriveTodayAgenda(leads).slice(0, 8);
  return (
    <DashboardCard
      title="Today"
      icon={CalendarClock}
      viewAllHref="/dashboard/leads?bucket=today"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={entries.length === 0}
      emptyTitle="Nothing scheduled today."
      emptyDescription="No meetings or follow-ups due — check the Priority Queue for what's next."
    >
      <ul className="flex flex-col divide-y divide-line-soft">
        {entries.map((entry) => (
          <li key={`${entry.kind}-${entry.lead.id}`}>
            <Link
              href={`/dashboard/leads/${entry.lead.id}#${entry.kind === "meeting" ? "meeting" : "follow-ups"}`}
              className="flex items-center gap-3 px-2 py-2.5 text-sm hover:bg-surface-hover"
            >
              <Avatar name={entry.lead.contact.name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-ink">{entry.lead.contact.name || "Unnamed lead"}</div>
                {entry.kind === "meeting" ? (
                  <div className="flex items-center gap-1.5 text-xs text-subtle">
                    <Video className="h-3.5 w-3.5 shrink-0" />
                    Meeting · {relativeTimeFromNow(entry.at)}
                  </div>
                ) : (
                  <NextActionCell lead={entry.lead} />
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}
