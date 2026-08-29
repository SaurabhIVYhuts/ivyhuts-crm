"use client";

import { useEffect, useState } from "react";
import { Activity, PieChart } from "lucide-react";
import { listLeads } from "@/lib/api/leads";
import type { Lead } from "@/types/lead";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatLabel, startOfDay } from "@/lib/utils/format";

const SAMPLE_SIZE = 200;
const ACTIVITY_DAYS = 14;

function buildDailyActivity(leads: Lead[]): { label: string; count: number }[] {
  const today = startOfDay(new Date());
  const buckets = new Map<number, number>();
  for (let i = ACTIVITY_DAYS - 1; i >= 0; i--) buckets.set(today - i * 86_400_000, 0);
  for (const lead of leads) {
    const day = startOfDay(new Date(lead.createdAt));
    if (buckets.has(day)) buckets.set(day, (buckets.get(day) || 0) + 1);
  }
  return [...buckets.entries()].map(([day, count]) => ({
    label: new Date(day).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
    count,
  }));
}

function buildSourceBreakdown(leads: Lead[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    const key = lead.source ? formatLabel(lead.source) : "Unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
}

function ActivityChart({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex h-40 items-end gap-1.5">
      {data.map((d, i) => (
        <div key={i} className="group flex flex-1 flex-col items-center gap-1.5">
          <div className="relative flex w-full flex-1 items-end">
            <div
              className="w-full min-h-[3px] rounded-t-sm bg-accent/70 transition-colors group-hover:bg-accent"
              style={{ height: `${(d.count / max) * 100}%` }}
              title={`${d.label}: ${d.count} new lead${d.count === 1 ? "" : "s"}`}
            />
          </div>
          <span className="text-[10px] text-faint">{i % 2 === 0 ? d.label.split(" ")[0] : ""}</span>
        </div>
      ))}
    </div>
  );
}

function SourceBars({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ul className="flex flex-col gap-3">
      {data.slice(0, 6).map((d) => (
        <li key={d.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-ink">{d.label}</span>
            <span className="text-faint">{d.count}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent" style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Both charts share one bounded, real-data fetch (the agent/manager's most
// recent leads, same scope as the rest of "your sales pipeline today") —
// no fabricated data, no invented time series. See this file's own
// SAMPLE_SIZE: with more leads than that, the chart honestly reflects the
// most recent SAMPLE_SIZE rather than claiming to be exhaustive.
export function LeadAnalytics({ scopeUserId }: { scopeUserId: string | undefined }) {
  const [leads, setLeads] = useState<Lead[] | null>(null);

  useEffect(() => {
    if (!scopeUserId) return;
    let cancelled = false;
    listLeads({ assignedTo: scopeUserId, limit: SAMPLE_SIZE })
      .then((res) => {
        if (!cancelled) setLeads(res.data);
      })
      .catch(() => {
        if (!cancelled) setLeads([]);
      });
    return () => {
      cancelled = true;
    };
  }, [scopeUserId]);

  const activity = leads ? buildDailyActivity(leads) : [];
  const sources = leads ? buildSourceBreakdown(leads) : [];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Lead Activity" icon={Activity} description={`New leads over the last ${ACTIVITY_DAYS} days.`} />
        {leads === null ? (
          <Skeleton className="h-40 w-full" />
        ) : leads.length === 0 ? (
          <EmptyState compact title="No lead activity yet." description="New leads will appear here as they arrive." />
        ) : (
          <ActivityChart data={activity} />
        )}
      </Card>
      <Card>
        <CardHeader title="Lead Sources" icon={PieChart} description="Where your leads are coming from." />
        {leads === null ? (
          <Skeleton className="h-40 w-full" />
        ) : sources.length === 0 ? (
          <EmptyState compact title="No source data yet." />
        ) : (
          <SourceBars data={sources} />
        )}
      </Card>
    </div>
  );
}
