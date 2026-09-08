"use client";

// CRM plan item 2 — the agent's one-line status summary plus per-partner
// availability tracking (Amber, uHomes). Everything here is hand-entered;
// there is no partner-API integration. Persists through the normal
// PATCH /api/leads/:id (updateLead) — a partial body, so saving one
// partner never touches the other or the summary.
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { updateLead } from "@/lib/api/leads";
import {
  PARTNER_AVAILABILITY_STATUSES,
  type LeadDetail,
  type PartnerAvailability,
  type PartnerAvailabilityBlock,
  type PartnerAvailabilityStatus,
} from "@/types/lead";
import { ErrorState } from "@/components/ui/ErrorState";
import { describeApiError, type ApiErrorState } from "@/lib/utils/errors";
import { formatLabel, formatDate } from "@/lib/utils/format";

const PARTNERS: Array<{ key: "amber" | "uhomes"; label: string }> = [
  { key: "amber", label: "Amber" },
  { key: "uhomes", label: "uHomes" },
];

const EMPTY_BLOCK: PartnerAvailabilityBlock = { status: "not_requested", reply: null, updatedAt: null, updatedBy: null };

function blockOf(pa: PartnerAvailability | undefined, key: "amber" | "uhomes"): PartnerAvailabilityBlock {
  return pa?.[key] ?? EMPTY_BLOCK;
}

function PartnerRow({
  label,
  block,
  disabled,
  onSave,
}: {
  label: string;
  block: PartnerAvailabilityBlock;
  disabled: boolean;
  onSave: (next: { status: PartnerAvailabilityStatus; reply: string | null }) => Promise<void>;
}) {
  const [status, setStatus] = useState<PartnerAvailabilityStatus>(block.status);
  const [reply, setReply] = useState(block.reply || "");
  const [saving, setSaving] = useState(false);

  const dirty = status !== block.status || reply !== (block.reply || "");

  return (
    <div className="flex flex-col gap-1.5 border-t border-line pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink">{label}</span>
        {block.updatedAt && <span className="text-[11px] text-faint">Updated {formatDate(block.updatedAt)}</span>}
      </div>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as PartnerAvailabilityStatus)}
        disabled={disabled || saving}
        className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent"
      >
        {PARTNER_AVAILABILITY_STATUSES.map((s) => (
          <option key={s} value={s}>
            {formatLabel(s)}
          </option>
        ))}
      </select>
      <textarea
        rows={2}
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        disabled={disabled || saving}
        placeholder={`What ${label} said back…`}
        className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent"
      />
      {dirty && (
        <button
          type="button"
          onClick={async () => {
            setSaving(true);
            try {
              await onSave({ status, reply: reply.trim() === "" ? null : reply.trim() });
            } finally {
              setSaving(false);
            }
          }}
          disabled={disabled || saving}
          className="self-start rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50"
        >
          {saving ? "Saving…" : `Save ${label}`}
        </button>
      )}
    </div>
  );
}

export function PartnerAvailabilityControl({
  lead,
  onUpdated,
}: {
  lead: LeadDetail;
  onUpdated: (updated: Partial<LeadDetail>) => void;
}) {
  const [summary, setSummary] = useState(lead.summary || "");
  const [savingSummary, setSavingSummary] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<ApiErrorState | null>(null);

  const summaryDirty = summary !== (lead.summary || "");

  function flashSaved(what: string) {
    setSaved(what);
    setTimeout(() => setSaved(null), 2500);
  }

  async function saveSummary() {
    setSavingSummary(true);
    setError(null);
    try {
      const res = await updateLead(lead.id, { summary: summary.trim() === "" ? null : summary.trim() });
      onUpdated(res.data);
      flashSaved("summary");
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setSavingSummary(false);
    }
  }

  async function savePartner(key: "amber" | "uhomes", next: { status: PartnerAvailabilityStatus; reply: string | null }) {
    setError(null);
    try {
      const res = await updateLead(lead.id, { partnerAvailability: { [key]: next } });
      onUpdated(res.data);
      flashSaved(key);
    } catch (err) {
      setError(describeApiError(err));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-subtle">Summary</span>
        <input
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          disabled={savingSummary}
          maxLength={280}
          placeholder="e.g. Waiting on uHomes availability for Sept"
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent"
        />
        {summaryDirty && (
          <button
            type="button"
            onClick={saveSummary}
            disabled={savingSummary}
            className="mt-1 self-start rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50"
          >
            {savingSummary ? "Saving…" : "Save summary"}
          </button>
        )}
      </label>

      {PARTNERS.map(({ key, label }) => (
        <PartnerRow
          key={key}
          label={label}
          block={blockOf(lead.partnerAvailability, key)}
          disabled={savingSummary}
          onSave={(next) => savePartner(key, next)}
        />
      ))}

      {saved && (
        <span className="flex items-center gap-1 text-xs text-success">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Saved
        </span>
      )}
      {error && <ErrorState error={error} />}
    </div>
  );
}
