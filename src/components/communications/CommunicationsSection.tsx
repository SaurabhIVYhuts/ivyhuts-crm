"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle, Phone, Video, Mail, MessageSquare, Check, CheckCheck, AlertTriangle, CalendarClock, X, type LucideIcon } from "lucide-react";
import { listCommunications, createCommunication } from "@/lib/api/communications";
import type { Communication, CommunicationDirection } from "@/types/communication";
import { WhatsAppSendForm } from "@/components/communications/WhatsAppSendForm";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { describeApiError, type ApiErrorState } from "@/lib/utils/errors";
import { formatTime } from "@/lib/utils/format";

interface ChannelOption {
  label: string;
  channel: Communication["channel"];
  type: string;
  icon: LucideIcon;
}

// The 5 things an agent can actually pick from this form. "system" is
// deliberately excluded — that channel value is for automated/system-
// generated records (see Communication.js), not something an agent
// manually selects. Video Call reuses channel="phone" with a "video_call"
// type marker since the backend enum has no dedicated video-call value —
// see src/types/communication.ts.
const CHANNEL_OPTIONS: ChannelOption[] = [
  { label: "WhatsApp", channel: "whatsapp", type: "general", icon: MessageCircle },
  { label: "Phone Call", channel: "phone", type: "call", icon: Phone },
  { label: "Video Call", channel: "phone", type: "video_call", icon: Video },
  { label: "Email", channel: "email", type: "general", icon: Mail },
  { label: "SMS", channel: "sms", type: "general", icon: MessageSquare },
];

function describeCommunication(comm: Communication): { label: string; icon: LucideIcon } {
  const match = CHANNEL_OPTIONS.find((opt) => opt.channel === comm.channel && opt.type === comm.type);
  if (match) return { label: match.label, icon: match.icon };
  if (comm.channel === "phone") return { label: "Phone Call", icon: Phone };
  if (comm.channel === "whatsapp") return { label: "WhatsApp", icon: MessageCircle };
  if (comm.channel === "email") return { label: "Email", icon: Mail };
  if (comm.channel === "sms") return { label: "SMS", icon: MessageSquare };
  return { label: "System", icon: MessageSquare };
}

// CRM Milestone 14 — delivery-status ticks for an outbound WhatsApp message
// (spec §31), driven entirely by Communication.status as maintained by
// api/webhooks/whatsapp.js's status webhook. "sent" only ever means the
// WhatsApp API accepted the message, never that the customer received or
// read it — see that endpoint's own header comment. Nothing is shown for a
// status this CRM doesn't recognize (e.g. still null before any webhook
// has arrived), since asserting a status the provider hasn't actually
// confirmed would be exactly the kind of fabrication the spec forbids.
function whatsAppStatusBadge(status: string | null): { icon: LucideIcon; label: string; className: string } | null {
  switch (status) {
    case "sent":
      return { icon: Check, label: "Sent", className: "text-subtle dark:text-faint" };
    case "delivered":
      return { icon: CheckCheck, label: "Delivered", className: "text-subtle dark:text-faint" };
    case "read":
      return { icon: CheckCheck, label: "Read", className: "text-accent-strong dark:text-accent-strong" };
    case "failed":
      return { icon: AlertTriangle, label: "Failed", className: "text-danger dark:text-danger" };
    default:
      return null;
  }
}

function dayLabel(value: string): string {
  const date = new Date(value);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface DayGroup {
  label: string;
  items: Communication[];
}

function groupByDay(communications: Communication[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const comm of communications) {
    const label = dayLabel(comm.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(comm);
    } else {
      groups.push({ label, items: [comm] });
    }
  }
  return groups;
}

export function CommunicationsSection({
  leadId,
  phone,
  leadName,
}: {
  leadId: string;
  // Reused from the already-loaded Lead (see the parent page's `lead.contact`)
  // — no extra fetch needed to power the WhatsApp send form below.
  phone: string | null;
  leadName: string | null;
}) {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiErrorState | null>(null);

  const [optionIndex, setOptionIndex] = useState(0);
  const [direction, setDirection] = useState<CommunicationDirection>("outbound");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<ApiErrorState | null>(null);
  // Milestone 23.12 Part 9 — a lightweight prompt shown right after a
  // successful record, never an automatic follow-up creation (explicitly
  // ruled out unless the architecture already supports it, which it
  // doesn't). Dismissible, and cleared on the next form submission.
  const [showFollowUpPrompt, setShowFollowUpPrompt] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await listCommunications(leadId);
      setCommunications(res.data);
      setLoadError(null);
    } catch (err) {
      setLoadError(describeApiError(err));
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    // See src/hooks/useAuth.ts's own refresh() call for why this disable
    // is needed — setState only ever happens after an await inside load().
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    setShowFollowUpPrompt(false);
    const option = CHANNEL_OPTIONS[optionIndex];
    try {
      await createCommunication(leadId, {
        channel: option.channel,
        direction,
        type: option.type,
        content: content.trim() === "" ? null : content.trim(),
      });
      setContent("");
      // Only prompt after logging an OUTBOUND contact — an inbound
      // (customer-initiated) message doesn't imply the agent just finished
      // a call/conversation that needs a next-step scheduled.
      if (direction === "outbound") setShowFollowUpPrompt(true);
      await load();
    } catch (err) {
      setSubmitError(describeApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
 <div className="flex flex-col gap-5">
 <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-line p-4 dark:border-line">
 <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle dark:text-faint">
          Record Communication
        </h3>
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
 <label className="flex flex-col gap-1">
 <span className="text-xs font-medium text-subtle dark:text-faint">Channel</span>
            <select
              value={optionIndex}
              onChange={(e) => setOptionIndex(Number(e.target.value))}
              disabled={isSubmitting}
 className="rounded-md border border-line bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent dark:border-line dark:bg-accent"
            >
              {CHANNEL_OPTIONS.map((opt, i) => (
                <option key={opt.label} value={i}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
 <label className="flex flex-col gap-1">
 <span className="text-xs font-medium text-subtle dark:text-faint">Direction</span>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as CommunicationDirection)}
              disabled={isSubmitting}
 className="rounded-md border border-line bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent dark:border-line dark:bg-accent"
            >
              <option value="outbound">Outbound (agent → student)</option>
              <option value="inbound">Inbound (student → agent)</option>
            </select>
          </label>
        </div>
 <label className="flex flex-col gap-1">
 <span className="text-xs font-medium text-subtle dark:text-faint">Message / Notes</span>
          <textarea
            rows={2}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isSubmitting}
            placeholder="What happened? e.g. Shared personalized presentation with student."
 className="rounded-md border border-line bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent dark:border-line"
          />
        </label>

        {submitError && <ErrorState error={submitError} />}

        <div>
          <button
            type="submit"
            disabled={isSubmitting}
 className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50 "
          >
            {isSubmitting ? "Recording…" : "Record Communication"}
          </button>
        </div>
      </form>

      {showFollowUpPrompt && (
 <div className="flex items-center justify-between gap-2 rounded-md bg-accent-soft px-3 py-2 dark:bg-accent-soft">
 <p className="flex items-center gap-1.5 text-xs text-accent-strong dark:text-accent-strong">
 <CalendarClock className="h-3.5 w-3.5" />
            Communication recorded. Schedule a follow-up?
          </p>
 <div className="flex items-center gap-1">
            <a
              href="#follow-ups"
 className="rounded-md border border-accent/30 px-2.5 py-1 text-xs font-medium text-accent-strong hover:bg-accent-soft dark:border-accent/30 dark:text-accent-strong dark:hover:bg-accent-soft"
            >
              Create Follow-up
            </a>
            <button
              type="button"
              onClick={() => setShowFollowUpPrompt(false)}
              aria-label="Dismiss"
 className="rounded-md p-1 text-accent-strong hover:bg-accent-soft dark:text-accent-strong dark:hover:bg-accent-soft"
            >
 <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Distinct from "Record Communication" above — this form makes the
          CRM actually perform the external send (spec §8, §33), not merely
          log that something happened. */}
      <WhatsAppSendForm leadId={leadId} phone={phone} leadName={leadName} onSent={load} />

      {isLoading ? (
 <div className="flex flex-col gap-2">
 <Skeleton className="h-4 w-32" />
 <Skeleton className="h-16 w-full" />
        </div>
      ) : loadError ? (
        <ErrorState error={loadError} />
      ) : communications.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No communications recorded yet."
          description="Record the first call, WhatsApp message, or other customer interaction."
        />
      ) : (
 <div className="flex flex-col gap-5">
          {groupByDay(communications).map((group) => (
            <div key={group.label}>
 <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle dark:text-faint">
                {group.label}
              </div>
 <ul className="flex flex-col gap-3">
                {group.items.map((comm) => {
                  const { label, icon: Icon } = describeCommunication(comm);
                  const statusBadge = comm.channel === "whatsapp" && comm.direction === "outbound" ? whatsAppStatusBadge(comm.status) : null;
                  return (
 <li key={comm.id} className="flex items-start gap-3 rounded-md border border-line-soft p-3 text-sm dark:border-line">
 <Icon className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
 <div className="min-w-0 flex-1">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <span className="font-medium text-ink dark:text-ink">
                            {label} · {comm.direction === "outbound" ? "Outbound" : "Inbound"}
                          </span>
 <span className="text-xs text-subtle dark:text-faint">
                            {formatTime(comm.createdAt)}
                          </span>
                        </div>
                        {comm.content && (
 <p className="mt-0.5 text-subtle dark:text-subtle">{comm.content}</p>
                        )}
 <div className="mt-0.5 flex items-center gap-2 text-xs text-subtle dark:text-faint">
                          {comm.agentId ? (
                            <span>Agent #{comm.agentId.slice(-6)}</span>
                          ) : comm.direction === "inbound" ? (
                            // Never a fabricated agent name for a customer-
                            // sent message (spec §30).
                            <span>Customer</span>
                          ) : null}
                          {statusBadge && (
 <span className={`flex items-center gap-0.5 ${statusBadge.className}`}>
 <statusBadge.icon className="h-3 w-3" />
                              {statusBadge.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
