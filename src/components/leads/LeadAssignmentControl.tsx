"use client";

import { useEffect, useState } from "react";
import { UserRound, CheckCircle2 } from "lucide-react";
import { listStaff } from "@/lib/api/staff";
import { assignLead } from "@/lib/api/leads";
import type { StaffUser } from "@/types/staff";
import type { Lead } from "@/types/lead";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { describeApiError, type ApiErrorState } from "@/lib/utils/errors";

export function LeadAssignmentControl({
  lead,
  onUpdated,
}: {
  lead: Lead;
  onUpdated: (lead: Lead) => void;
}) {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);
  const [loadError, setLoadError] = useState<ApiErrorState | null>(null);

  const [isPicking, setIsPicking] = useState(false);
  const [selected, setSelected] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<ApiErrorState | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listStaff()
      .then((res) => {
        if (!cancelled) setStaff(res.data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(describeApiError(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingStaff(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentAgent = staff.find((s) => s.id === lead.assignedTo) || null;

  function startPicking() {
    setSelected(lead.assignedTo || "");
    setSaveError(null);
    setSaved(false);
    setIsPicking(true);
  }

  async function handleConfirm() {
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await assignLead(lead.id, selected === "" ? null : selected);
      onUpdated(res.data);
      setIsPicking(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError(describeApiError(err));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoadingStaff) {
    return <Skeleton className="h-16 w-full" />;
  }

  if (loadError) {
    return <ErrorState error={loadError} />;
  }

  return (
    <div>
      {!isPicking ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm">
            <UserRound className="h-4 w-4 shrink-0 text-faint" />
            {currentAgent ? (
              <span className="text-ink">
                {currentAgent.name}
                <span className="ml-1.5 text-xs text-faint">({currentAgent.role.replace(/_/g, " ")})</span>
              </span>
            ) : lead.assignedTo ? (
              <span className="text-subtle">Agent #{lead.assignedTo.slice(-6)} (not in current staff list)</span>
            ) : (
              <span className="text-subtle">Unassigned</span>
            )}
            {saved && (
              <span className="ml-1 flex items-center gap-1 text-xs text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Saved
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={startPicking}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-subtle hover:bg-surface-2 hover:text-ink"
          >
            {lead.assignedTo ? "Reassign" : "Assign Agent"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {!lead.assignedTo && <p className="text-sm text-subtle">No agent assigned. Assign this lead to an internal team member.</p>}
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={isSaving}
            className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent"
          >
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.role.replace(/_/g, " ")})
              </option>
            ))}
          </select>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSaving}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setIsPicking(false)}
              disabled={isSaving}
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-subtle hover:bg-surface-2 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
          {saveError && <ErrorState error={saveError} />}
        </div>
      )}
    </div>
  );
}
