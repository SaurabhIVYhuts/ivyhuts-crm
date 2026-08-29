"use client";

import { useEffect, useState } from "react";
import { Phone, Mail, MessageCircle, Video, MoreHorizontal, type LucideIcon } from "lucide-react";
import { listFollowUps } from "@/lib/api/followUps";
import type { FollowUp, FollowUpType } from "@/types/followUp";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatTime, formatLabel, relativeDay } from "@/lib/utils/format";

// Exported for reuse by the Lead Inbox's Next Action column (Milestone 11)
// — same icon-per-type mapping, not a second copy.
export const TYPE_ICONS: Record<FollowUpType, LucideIcon> = {
  call: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  meeting: Video,
  other: MoreHorizontal,
};

export function NextActionCard({ leadId }: { leadId: string }) {
  const [next, setNext] = useState<FollowUp | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listFollowUps(leadId)
      .then((res) => {
        if (cancelled) return;
        const pending = res.data
          .filter((fu) => fu.status === "pending")
          .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
        setNext(pending[0] || null);
      })
      .catch(() => {
        if (!cancelled) setHasError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  if (isLoading) {
 return <Skeleton className="h-16 w-full" />;
  }

  // Non-blocking — Next Action is a convenience summary, not core data;
  // the Follow-ups section below shows the real error state if this fails.
  if (hasError) return null;

  if (!next) {
    return (
 <div className="flex items-center justify-between rounded-lg border border-dashed border-line px-4 py-3 dark:border-line">
        <div>
 <div className="text-xs font-semibold uppercase tracking-wide text-subtle dark:text-faint">
            Next Action
          </div>
 <p className="text-sm text-subtle dark:text-faint">No follow-up scheduled.</p>
        </div>
        <a
          href="#follow-ups"
 className="rounded-md border border-line px-3 py-1.5 text-sm text-subtle hover:bg-surface-2 dark:border-line dark:text-subtle dark:hover:bg-surface-2"
        >
          Schedule Follow-up
        </a>
      </div>
    );
  }

  const Icon = TYPE_ICONS[next.type] || MoreHorizontal;
  const overdue = new Date(next.dueAt).getTime() < new Date().getTime();

  return (
    <a
      href="#follow-ups"
 className={`flex items-start gap-3 rounded-lg border px-4 py-3 hover:bg-surface-2 dark:hover:bg-surface-2 ${
        overdue
          ? "border-danger/30 bg-danger/10 dark:border-danger/30 dark:bg-danger/10"
          : "border-line dark:border-line"
      }`}
    >
 <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${overdue ? "text-danger" : "text-faint"}`} />
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-subtle dark:text-faint">
 Next Action {overdue && <span className="text-danger dark:text-danger">· Overdue</span>}
        </div>
 <div className="text-sm font-medium text-ink dark:text-ink">
          {formatLabel(next.type)} · {relativeDay(next.dueAt)} · {formatTime(next.dueAt)}
        </div>
 {next.notes && <p className="text-sm text-subtle dark:text-faint">{next.notes}</p>}
      </div>
    </a>
  );
}
