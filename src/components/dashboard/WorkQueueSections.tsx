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
import { Phone, MessageCircle, CalendarClock, ArrowRight, Flame, Inbox as InboxIcon, type LucideIcon } from "lucide-react";
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
// follow-ups, brand-new leads, and (Milestone 23.12) the three pipeline-gap
// signals the backend now computes (discoveryIncomplete/readyForFindRooms/
// presentationNoFollowUp) into one deterministic priority-ordered list —
// same priority order as BUCKET_SORT_RANK in api/leads/work-queue.js, with
// "replied" (a frontend-only signal — see isAwaitingReply — the backend has
// no bucket for it) slotted in right after overdue, matching this
// component's own pre-existing worked example. No AI, no scoring model:
// just the backend's own `bucket` field plus the one reply signal, merged
// and de-duplicated.
export interface PriorityItem {
  lead: WorkQueueLead;
  reason: "overdue" | "replied" | "meetingToday" | "today" | "new" | "discoveryIncomplete" | "readyForFindRooms" | "presentationNoFollowUp";
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
    { reason: "presentationNoFollowUp", items: leads.filter((l) => l.bucket === "presentationNoFollowUp") },
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
    case "presentationNoFollowUp":
      return { label: "Presentation generated — needs follow-up", time: "—" };
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

export function TodaysFollowUpsCard({
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
  const items = leads.filter((l) => l.bucket === "today").slice(0, 5);
  return (
    <DashboardCard
      title="Today's Follow-ups"
      icon={CalendarClock}
      viewAllHref="/dashboard/leads?bucket=today"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={items.length === 0}
      emptyTitle="No follow-ups today."
      emptyDescription="You're all caught up for today."
    >
      <ul className="flex flex-col divide-y divide-line-soft">
        {items.map((lead) => (
          <li key={lead.id}>
            <Link href={`/dashboard/leads/${lead.id}#follow-ups`} className="flex items-center gap-3 px-2 py-2.5 text-sm hover:bg-surface-hover">
              <Avatar name={lead.contact.name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-ink">{lead.contact.name || "Unnamed lead"}</div>
                <NextActionCell lead={lead} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

// Milestone 23.12 — "Who has a meeting today?" (Part 3) gets its own card,
// same shell/pattern as TodaysFollowUpsCard, since a same-day meeting is
// time-sensitive in a way the Priority Queue's 5-item cap can bury.
export function MeetingTodayCard({
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
  const items = leads.filter((l) => l.bucket === "meetingToday").slice(0, 5);
  return (
    <DashboardCard
      title="Meetings Today"
      icon={CalendarClock}
      viewAllHref="/dashboard/meetings"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={items.length === 0}
      emptyTitle="No meetings scheduled today."
    >
      <ul className="flex flex-col divide-y divide-line-soft">
        {items.map((lead) => (
          <li key={lead.id}>
            <Link href={`/dashboard/leads/${lead.id}#meeting`} className="flex items-center gap-3 px-2 py-2.5 text-sm hover:bg-surface-hover">
              <Avatar name={lead.contact.name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-ink">{lead.contact.name || "Unnamed lead"}</div>
                <div className="text-xs text-subtle">{lead.nextMeeting ? relativeTimeFromNow(lead.nextMeeting.scheduledAt) : "—"}</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

export function OverdueCard({
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
  const items = leads.filter((l) => l.bucket === "overdue").slice(0, 5);
  return (
    <DashboardCard
      title="Overdue"
      icon={CalendarClock}
      viewAllHref="/dashboard/leads?bucket=overdue"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={items.length === 0}
      emptyTitle="No overdue work."
    >
      <ul className="flex flex-col divide-y divide-line-soft">
        {items.map((lead) => (
          <li key={lead.id}>
            <Link href={`/dashboard/leads/${lead.id}#follow-ups`} className="flex items-center gap-3 px-2 py-2.5 text-sm hover:bg-surface-hover">
              <Avatar name={lead.contact.name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-ink">{lead.contact.name || "Unnamed lead"}</div>
                <NextActionCell lead={lead} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

export function RecentRepliesCard({
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
  const items = deriveAwaitingReplies(leads).slice(0, 5);
  return (
    <DashboardCard
      title="Recent Replies"
      icon={InboxIcon}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={items.length === 0}
      emptyTitle="No recent customer replies."
      emptyDescription="New WhatsApp replies from your leads will show up here."
    >
      <ul className="flex flex-col divide-y divide-line-soft">
        {items.map((lead) => (
          <li key={lead.id}>
            <Link
              href={`/dashboard/leads/${lead.id}#communications`}
              className="flex items-center gap-3 px-2 py-2.5 text-sm hover:bg-surface-hover"
            >
              <Avatar name={lead.contact.name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-ink">{lead.contact.name || "Unnamed lead"}</div>
                <div className="text-xs text-warning">Customer replied · {relativeTimeFromNow(lead.lastInboundCommunicationAt)}</div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-faint" />
            </Link>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}
