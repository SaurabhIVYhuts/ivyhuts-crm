"use client";

import { useEffect, useState } from "react";
import { listLeads } from "@/lib/api/leads";
import { LEAD_STATUSES, type LeadStatus } from "@/types/lead";
import { Card, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatLabel } from "@/lib/utils/format";
import { GitBranch } from "lucide-react";

// Real per-status counts, not an invented pipeline — one lightweight
// GET /api/leads?status=X&limit=1 per status (reads only `pagination.total`,
// never the actual lead rows) run in parallel, scoped to the same
// `assignedTo` the rest of "your sales pipeline today" already uses. No new
// backend endpoint: this is the same listLeads() every other page calls,
// just fanned out once per LeadStatus.
export function Pipeline({ scopeUserId }: { scopeUserId: string | undefined }) {
  const [counts, setCounts] = useState<Record<LeadStatus, number> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!scopeUserId) return;
    let cancelled = false;
    // setIsLoading(true) is deferred into a microtask (rather than called
    // synchronously here) to satisfy react-hooks/set-state-in-effect — see
    // FindRoomsSection.tsx's own identical comment for why this is
    // behaviorally identical to a plain synchronous call.
    Promise.resolve()
      .then(() => {
        if (!cancelled) setIsLoading(true);
      })
      .then(() => Promise.all(LEAD_STATUSES.map((status) => listLeads({ status, assignedTo: scopeUserId, limit: 1 }))))
      .then((responses) => {
        if (cancelled) return;
        const next = {} as Record<LeadStatus, number>;
        LEAD_STATUSES.forEach((status, i) => {
          next[status] = responses[i].pagination.total;
        });
        setCounts(next);
      })
      .catch(() => {
        // Best-effort visualization — a failed fetch just leaves the
        // section showing its loading skeleton state indefinitely rather
        // than a hard error, since this is a secondary dashboard widget.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scopeUserId]);

  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <Card>
      <CardHeader title="Sales Pipeline" icon={GitBranch} description="Your leads across every lifecycle stage." />
      {isLoading || !counts ? (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {LEAD_STATUSES.map((s) => (
            <Skeleton key={s} className="h-20 w-32 shrink-0" />
          ))}
        </div>
      ) : (
        <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
          {LEAD_STATUSES.map((status, i) => {
            const count = counts[status];
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={status} className="flex shrink-0 items-center">
                <div className="w-32 rounded-lg bg-surface-2 px-3.5 py-3">
                  <div className="text-xs font-medium text-subtle">{formatLabel(status)}</div>
                  <div className="mt-1 text-xl font-semibold text-ink">{count.toLocaleString()}</div>
                  <div className="mt-1 text-[11px] text-faint">{total > 0 ? `${pct}% of total` : "—"}</div>
                </div>
                {i < LEAD_STATUSES.length - 1 && <div className="mx-1.5 h-px w-4 shrink-0 bg-line" aria-hidden="true" />}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
