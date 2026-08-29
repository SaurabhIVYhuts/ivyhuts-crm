"use client";

import { useCallback, useEffect, useState } from "react";
import { Phone, Mail, MessageCircle, Video, MoreHorizontal, CalendarClock, type LucideIcon } from "lucide-react";
import { listFollowUps, createFollowUp, updateFollowUp } from "@/lib/api/followUps";
import type { FollowUp, FollowUpType } from "@/types/followUp";
import { FOLLOWUP_TYPES, FOLLOWUP_PRIORITIES } from "@/types/followUp";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { describeApiError, type ApiErrorState } from "@/lib/utils/errors";
import { formatDate, formatTime, formatLabel } from "@/lib/utils/format";

const TYPE_ICONS: Record<FollowUpType, LucideIcon> = {
  call: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  meeting: Video,
  other: MoreHorizontal,
};

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export type Bucket = "overdue" | "today" | "upcoming" | "completed" | "cancelled";

// Exported for direct unit testing (src/components/follow-ups/__tests__/
// bucketing.test.ts) — same "test the pure logic directly, no jsdom" reason
// as src/components/leads/SalesJourney.tsx's buildStages/computeCurrentIndex.
export function bucketOf(fu: FollowUp): Bucket {
  if (fu.status === "completed") return "completed";
  if (fu.status === "cancelled") return "cancelled";
  const due = new Date(fu.dueAt);
  const today = startOfDay(new Date());
  const dueDay = startOfDay(due);
  if (dueDay < today) return "overdue";
  if (dueDay === today) return "today";
  return "upcoming";
}

const BUCKET_LABELS: Record<Bucket, string> = {
  overdue: "Overdue",
  today: "Today",
  upcoming: "Upcoming",
  completed: "Completed",
  cancelled: "Cancelled",
};
const BUCKET_ORDER: Bucket[] = ["overdue", "today", "upcoming", "completed", "cancelled"];

function FollowUpRow({
  followUp,
  onComplete,
  onCancel,
  busy,
}: {
  followUp: FollowUp;
  onComplete: (id: string, notes: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  busy: boolean;
}) {
  const [isCompleting, setIsCompleting] = useState(false);
  const [outcomeNotes, setOutcomeNotes] = useState(followUp.notes || "");
  const Icon = TYPE_ICONS[followUp.type] || MoreHorizontal;
  const isPending = followUp.status === "pending";

  return (
 <li className="rounded-md border border-line-soft p-3 text-sm dark:border-line">
 <div className="flex items-start gap-3">
 <Icon className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
 <div className="min-w-0 flex-1">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <span className="font-medium text-ink dark:text-ink">
              {formatLabel(followUp.type)} · {formatLabel(followUp.priority)} priority
            </span>
 <span className="text-xs text-subtle dark:text-faint">
              {formatDate(followUp.dueAt)} · {formatTime(followUp.dueAt)}
            </span>
          </div>
          {followUp.notes && !isCompleting && (
 <p className="mt-0.5 text-subtle dark:text-subtle">{followUp.notes}</p>
          )}

          {isPending && !isCompleting && (
 <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setIsCompleting(true)}
 className="rounded-md border border-line px-2.5 py-1 text-xs text-subtle hover:bg-surface-2 disabled:opacity-50 dark:border-line dark:text-subtle dark:hover:bg-surface-2"
              >
                Mark Complete
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onCancel(followUp.id)}
 className="rounded-md border border-line px-2.5 py-1 text-xs text-subtle hover:bg-surface-2 disabled:opacity-50 dark:border-line dark:text-faint dark:hover:bg-surface-2"
              >
                Cancel
              </button>
            </div>
          )}

          {isCompleting && (
 <div className="mt-2 flex flex-col gap-2">
 <label className="flex flex-col gap-1">
 <span className="text-xs font-medium text-subtle dark:text-faint">Outcome / Notes</span>
                <textarea
                  rows={2}
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                  disabled={busy}
 className="rounded-md border border-line bg-transparent px-2 py-1 text-sm outline-none focus:border-accent dark:border-line"
                />
              </label>
 <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onComplete(followUp.id, outcomeNotes)}
 className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-strong disabled:opacity-50 "
                >
                  {busy ? "Saving…" : "Confirm Complete"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setIsCompleting(false)}
 className="rounded-md border border-line px-3 py-1 text-xs text-subtle hover:bg-surface-2 disabled:opacity-50 dark:border-line dark:text-subtle dark:hover:bg-surface-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export function FollowUpsSection({ leadId }: { leadId: string }) {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiErrorState | null>(null);

  const [typeIndex, setTypeIndex] = useState(0);
  const [priority, setPriority] = useState<(typeof FOLLOWUP_PRIORITIES)[number]>("medium");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<ApiErrorState | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<ApiErrorState | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await listFollowUps(leadId);
      setFollowUps(res.data);
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
    if (!date || !time) {
      setSubmitError({ kind: "unknown", message: "Pick a date and time for this follow-up." });
      return;
    }
    const dueAt = new Date(`${date}T${time}`);
    if (Number.isNaN(dueAt.getTime())) {
      setSubmitError({ kind: "unknown", message: "That date/time isn't valid." });
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await createFollowUp(leadId, {
        type: FOLLOWUP_TYPES[typeIndex],
        dueAt: dueAt.toISOString(),
        priority,
        notes: notes.trim() === "" ? null : notes.trim(),
      });
      setDate("");
      setTime("");
      setNotes("");
      await load();
    } catch (err) {
      setSubmitError(describeApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleComplete(id: string, outcomeNotes: string) {
    setBusyId(id);
    setActionError(null);
    try {
      await updateFollowUp(leadId, id, {
        status: "completed",
        notes: outcomeNotes.trim() === "" ? null : outcomeNotes.trim(),
      });
      await load();
    } catch (err) {
      setActionError(describeApiError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(id: string) {
    setBusyId(id);
    setActionError(null);
    try {
      await updateFollowUp(leadId, id, { status: "cancelled" });
      await load();
    } catch (err) {
      setActionError(describeApiError(err));
    } finally {
      setBusyId(null);
    }
  }

  const groups = BUCKET_ORDER.map((bucket) => ({
    bucket,
    items: followUps.filter((fu) => bucketOf(fu) === bucket),
  })).filter((g) => g.items.length > 0);

  return (
 <div id="follow-ups" className="flex flex-col gap-5">
 <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-line p-4 dark:border-line">
 <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle dark:text-faint">
          Create Follow-up
        </h3>
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
 <label className="flex flex-col gap-1">
 <span className="text-xs font-medium text-subtle dark:text-faint">Type</span>
            <select
              value={typeIndex}
              onChange={(e) => setTypeIndex(Number(e.target.value))}
              disabled={isSubmitting}
 className="rounded-md border border-line bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent dark:border-line dark:bg-accent"
            >
              {FOLLOWUP_TYPES.map((t, i) => (
                <option key={t} value={i}>
                  {formatLabel(t)}
                </option>
              ))}
            </select>
          </label>
 <label className="flex flex-col gap-1">
 <span className="text-xs font-medium text-subtle dark:text-faint">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isSubmitting}
 className="rounded-md border border-line bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent dark:border-line"
            />
          </label>
 <label className="flex flex-col gap-1">
 <span className="text-xs font-medium text-subtle dark:text-faint">Time</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={isSubmitting}
 className="rounded-md border border-line bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent dark:border-line"
            />
          </label>
 <label className="flex flex-col gap-1">
 <span className="text-xs font-medium text-subtle dark:text-faint">Priority</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as (typeof FOLLOWUP_PRIORITIES)[number])}
              disabled={isSubmitting}
 className="rounded-md border border-line bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent dark:border-line dark:bg-accent"
            >
              {FOLLOWUP_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {formatLabel(p)}
                </option>
              ))}
            </select>
          </label>
        </div>
 <label className="flex flex-col gap-1">
 <span className="text-xs font-medium text-subtle dark:text-faint">Notes</span>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSubmitting}
            placeholder="e.g. Call regarding accommodation options"
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
            {isSubmitting ? "Scheduling…" : "Schedule Follow-up"}
          </button>
        </div>
      </form>

      {actionError && <ErrorState error={actionError} />}

      {isLoading ? (
 <div className="flex flex-col gap-2">
 <Skeleton className="h-4 w-32" />
 <Skeleton className="h-16 w-full" />
        </div>
      ) : loadError ? (
        <ErrorState error={loadError} />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No follow-ups scheduled yet."
          description="Schedule the next call, WhatsApp message, or meeting above."
        />
      ) : (
 <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <div key={group.bucket}>
 <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle dark:text-faint">
                {BUCKET_LABELS[group.bucket]}
              </div>
 <ul className="flex flex-col gap-2">
                {group.items.map((fu) => (
                  <FollowUpRow
                    key={fu.id}
                    followUp={fu}
                    onComplete={handleComplete}
                    onCancel={handleCancel}
                    busy={busyId === fu.id}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
