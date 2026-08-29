"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { updateLead } from "@/lib/api/leads";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/types/lead";
import { StatusBadge } from "@/components/leads/StatusBadge";
import { ErrorState } from "@/components/ui/ErrorState";
import { describeApiError, type ApiErrorState } from "@/lib/utils/errors";
import { formatLabel } from "@/lib/utils/format";

// Lead has no dedicated "nurturing reason" field — per CRM Milestone 8
// spec §11, this reuses the existing free-text Lead.notes field rather
// than adding schema for it. Only sent to the backend when the target
// status is actually "nurturing", so switching to any other status never
// silently touches unrelated existing notes.
export function LeadStatusControl({
  lead,
  onUpdated,
}: {
  lead: Lead;
  onUpdated: (lead: Lead) => void;
}) {
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [reason, setReason] = useState(lead.notes || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<ApiErrorState | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = status !== lead.status || (status === "nurturing" && reason !== (lead.notes || ""));

  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await updateLead(lead.id, {
        status,
        ...(status === "nurturing" ? { notes: reason.trim() === "" ? undefined : reason.trim() } : {}),
      });
      onUpdated(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError(describeApiError(err));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <StatusBadge status={lead.status} />
        {saved && (
          <span className="flex items-center gap-1 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Updated
          </span>
        )}
      </div>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as LeadStatus)}
        disabled={isSaving}
        className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent"
      >
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>
            {formatLabel(s)}
          </option>
        ))}
      </select>

      {status === "nurturing" && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-subtle">Nurturing Reason (optional)</span>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSaving}
            placeholder="e.g. Student comparing options with parents"
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent"
          />
        </label>
      )}

      {dirty && (
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
      )}

      {saveError && <ErrorState error={saveError} />}
    </div>
  );
}
