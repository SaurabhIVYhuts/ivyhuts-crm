"use client";

// Milestone 23.10 — real Meetings backend (api/leads/[id]/meetings/*), not
// a placeholder. No recording provider is integrated anywhere in this
// codebase: recordingStatus is a state an agent sets manually after the
// fact (e.g. "I uploaded the recording to our shared drive, here's the
// link"), never something this UI fetches, verifies, or infers. A
// "Recording available" pill backed by a URL the agent typed in is an
// honest representation of that — it is not a claim that IVYHUTS has
// recording infrastructure.
//
// Milestone 23.14 — meetingUrl IS a real integration (Google Meet, via a
// service-account-backed provider on the backend): shown as a real "Join"
// link only when the backend actually returned one, honestly absent
// otherwise. transcriptText/extraction ARE real too (AI-assisted, via the
// backend's transcriptExtraction.js) — but the resulting suggestion is
// reviewed and confirmed from the Discovery section, not here, since
// Discovery remains the sole place a requirement becomes real (see
// DiscoverySection's Agent Review panel).
import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Plus, Video, FileText, ExternalLink, Sparkles } from "lucide-react";
import { listMeetings, createMeeting, updateMeeting, extractMeetingRequirements } from "@/lib/api/meetings";
import { ApiRequestError } from "@/lib/api/client";
import type { Meeting, MediaStatus, MeetingStatus } from "@/types/meeting";
import { MEETING_STATUSES, MEDIA_STATUSES } from "@/types/meeting";
import { MANAGEMENT_ROLES, type Role } from "@/types/auth";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { describeApiError, type ApiErrorState } from "@/lib/utils/errors";
import { formatDateTime } from "@/lib/utils/format";

const STATUS_STYLES: Record<MeetingStatus, string> = {
  scheduled: "bg-accent/10 text-accent-strong",
  completed: "bg-success/10 text-success",
  cancelled: "bg-line text-faint",
};

const MEDIA_LABELS: Record<MediaStatus, string> = {
  none: "None",
  pending: "Pending",
  available: "Available",
};

const selectClass =
  "rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-accent";
const inputClass =
  "w-full rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-accent";

// datetime-local inputs take/return a timezone-less "YYYY-MM-DDTHH:mm"
// string that the browser interprets in its own local timezone — same
// convention the Schedule Meeting form below already uses on create
// (new Date(value).toISOString() on submit); this mirrors that exact
// round-trip for editing an existing scheduledAt, never inventing a
// second timezone convention.
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Renders a status dropdown plus, only when set to "available", a text
// input for the reference — never shows a reference field for a status
// that couldn't honestly have one.
function MediaControl({
  label,
  icon: Icon,
  status,
  reference,
  onSave,
  disabled,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  status: MediaStatus;
  reference: string | null;
  onSave: (status: MediaStatus, reference: string | null) => Promise<void>;
  disabled: boolean;
}) {
  const [draftStatus, setDraftStatus] = useState(status);
  const [draftRef, setDraftRef] = useState(reference || "");
  const [saving, setSaving] = useState(false);
  const dirty = draftStatus !== status || (draftStatus === "available" && draftRef !== (reference || ""));

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(draftStatus, draftStatus === "available" ? draftRef.trim() : null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-subtle">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          className={selectClass}
          value={draftStatus}
          disabled={disabled || saving}
          onChange={(e) => setDraftStatus(e.target.value as MediaStatus)}
        >
          {MEDIA_STATUSES.map((s) => (
            <option key={s} value={s}>
              {MEDIA_LABELS[s]}
            </option>
          ))}
        </select>
        {draftStatus === "available" && (
          <input
            className={`${inputClass} min-w-[10rem] flex-1`}
            placeholder="Link or reference…"
            value={draftRef}
            disabled={disabled || saving}
            onChange={(e) => setDraftRef(e.target.value)}
          />
        )}
        {dirty && (
          <button
            type="button"
            onClick={handleSave}
            disabled={disabled || saving || (draftStatus === "available" && !draftRef.trim())}
            className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-white hover:bg-accent-strong disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        )}
      </div>
      {status === "available" && reference && draftStatus === "available" && draftRef === reference && (
        <div className="truncate text-xs text-subtle">{reference}</div>
      )}
    </div>
  );
}

function MeetingCard({
  meeting,
  onUpdated,
  canManageSchedule,
}: {
  meeting: Meeting;
  onUpdated: (m: Meeting) => void;
  canManageSchedule: boolean;
}) {
  const [statusSaving, setStatusSaving] = useState(false);
  const [actionError, setActionError] = useState<ApiErrorState | null>(null);

  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleValue, setRescheduleValue] = useState("");
  const [savingReschedule, setSavingReschedule] = useState(false);

  const [transcriptText, setTranscriptText] = useState(meeting.transcriptText ?? "");
  const [savingTranscript, setSavingTranscript] = useState(false);
  const [extracting, setExtracting] = useState(false);
  // A 503 here means the AI extraction service genuinely isn't configured
  // on this deployment — an expected, actionable state, not a server
  // fault. Shown as an honest inline notice (same pattern as the "No
  // Google Meet link" message above), never the generic 5xx ErrorState.
  const [extractUnavailable, setExtractUnavailable] = useState(false);
  const transcriptDirty = transcriptText !== (meeting.transcriptText ?? "");

  async function handleStatusChange(status: MeetingStatus) {
    setStatusSaving(true);
    setActionError(null);
    try {
      const res = await updateMeeting(meeting.leadId, meeting.id, { status });
      onUpdated(res.data);
    } catch (err) {
      setActionError(describeApiError(err));
    } finally {
      setStatusSaving(false);
    }
  }

  function handleOpenReschedule() {
    setRescheduleValue(toDatetimeLocalValue(meeting.scheduledAt));
    setActionError(null);
    setRescheduling(true);
  }

  async function handleRescheduleSave() {
    if (!rescheduleValue) return;
    setSavingReschedule(true);
    setActionError(null);
    try {
      const res = await updateMeeting(meeting.leadId, meeting.id, { scheduledAt: new Date(rescheduleValue).toISOString() });
      onUpdated(res.data);
      setRescheduling(false);
    } catch (err) {
      setActionError(describeApiError(err));
    } finally {
      setSavingReschedule(false);
    }
  }

  async function handleRecordingSave(recordingStatus: MediaStatus, recordingUrl: string | null) {
    setActionError(null);
    try {
      const res = await updateMeeting(meeting.leadId, meeting.id, { recordingStatus, recordingUrl });
      onUpdated(res.data);
    } catch (err) {
      setActionError(describeApiError(err));
    }
  }

  async function handleTranscriptSave(transcriptStatus: MediaStatus, transcriptReference: string | null) {
    setActionError(null);
    try {
      const res = await updateMeeting(meeting.leadId, meeting.id, { transcriptStatus, transcriptReference });
      onUpdated(res.data);
    } catch (err) {
      setActionError(describeApiError(err));
    }
  }

  async function handleTranscriptTextSave() {
    setSavingTranscript(true);
    setActionError(null);
    try {
      const res = await updateMeeting(meeting.leadId, meeting.id, { transcriptText: transcriptText.trim() || null });
      onUpdated(res.data);
    } catch (err) {
      setActionError(describeApiError(err));
    } finally {
      setSavingTranscript(false);
    }
  }

  async function handleExtract() {
    setExtracting(true);
    setActionError(null);
    setExtractUnavailable(false);
    try {
      const res = await extractMeetingRequirements(meeting.leadId, meeting.id);
      onUpdated(res.data);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 503) {
        setExtractUnavailable(true);
      } else {
        setActionError(describeApiError(err));
      }
    } finally {
      setExtracting(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-md border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <CalendarClock className="h-4 w-4 text-faint" />
          <span className="font-medium text-ink">{formatDateTime(meeting.scheduledAt)}</span>
          {/* Rescheduling is management's call, same authority as who may
              cancel above — enforced server-side (see .../meetings/[meetingId]/index.js's
              MANAGEMENT_ROLES check); hidden here for an agent as a UX
              convenience only. */}
          {canManageSchedule && meeting.status === "scheduled" && !rescheduling && (
            <button
              type="button"
              onClick={handleOpenReschedule}
              className="text-xs font-medium text-faint underline hover:text-ink"
            >
              Reschedule
            </button>
          )}
        </div>
        <select
          className={`${selectClass} ${STATUS_STYLES[meeting.status]}`}
          value={meeting.status}
          disabled={statusSaving}
          onChange={(e) => handleStatusChange(e.target.value as MeetingStatus)}
        >
          {/* Cancelling is a scheduling decision (see .../meetings/[meetingId]/index.js's
              server-side MANAGEMENT_ROLES check) — hidden here for a non-management
              role rather than left to fail server-side, except when the meeting is
              already cancelled, so the current value stays a valid option. */}
          {MEETING_STATUSES.filter((s) => canManageSchedule || s !== "cancelled" || meeting.status === "cancelled").map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {rescheduling && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-line p-2">
          <input
            type="datetime-local"
            className={inputClass}
            value={rescheduleValue}
            disabled={savingReschedule}
            onChange={(e) => setRescheduleValue(e.target.value)}
          />
          <button
            type="button"
            onClick={handleRescheduleSave}
            disabled={savingReschedule || !rescheduleValue}
            className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-white hover:bg-accent-strong disabled:opacity-50"
          >
            {savingReschedule ? "Saving…" : "Save new time"}
          </button>
          <button
            type="button"
            onClick={() => setRescheduling(false)}
            disabled={savingReschedule}
            className="rounded-md border border-line px-2 py-1 text-xs text-subtle hover:bg-surface-2 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Milestone 23.14 — a real Google Meet link, only ever present when
          the backend's provider actually configured and succeeded; honestly
          absent (no placeholder link) otherwise. */}
      {meeting.meetingUrl ? (
        <a
          href={meeting.meetingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-fit items-center gap-1.5 rounded-md bg-success/10 px-2.5 py-1.5 text-xs font-medium text-success hover:bg-success/20"
        >
          <Video className="h-3.5 w-3.5" />
          Join Google Meet
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        meeting.status === "scheduled" && (
          <p className="text-xs text-subtle">
            No Google Meet link — the Meet integration isn&apos;t configured on this deployment.
          </p>
        )
      )}

      {meeting.notes && <p className="text-sm text-subtle">{meeting.notes}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MediaControl
          label="Recording"
          icon={Video}
          status={meeting.recordingStatus}
          reference={meeting.recordingUrl}
          onSave={handleRecordingSave}
          disabled={meeting.status === "cancelled"}
        />
        <MediaControl
          label="Transcript link"
          icon={FileText}
          status={meeting.transcriptStatus}
          reference={meeting.transcriptReference}
          onSave={handleTranscriptSave}
          disabled={meeting.status === "cancelled"}
        />
      </div>

      {/* Milestone 23.14 — the actual transcript TEXT, independent of the
          reference/status pairing above. Pasting text here and extracting
          is real (AI-assisted, via the backend), but the result is only
          ever a SUGGESTION — reviewed and confirmed from the Discovery
          section below, never written here. */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-subtle">
          <FileText className="h-3.5 w-3.5" />
          Transcript text
        </div>
        <textarea
          className={`${inputClass} min-h-18 resize-y`}
          placeholder="Paste the meeting transcript here…"
          value={transcriptText}
          disabled={meeting.status === "cancelled" || savingTranscript}
          onChange={(e) => setTranscriptText(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          {transcriptDirty && (
            <button
              type="button"
              onClick={handleTranscriptTextSave}
              disabled={savingTranscript}
              className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-white hover:bg-accent-strong disabled:opacity-50"
            >
              {savingTranscript ? "Saving…" : "Save transcript"}
            </button>
          )}
          {!transcriptDirty && meeting.transcriptText && (
            <button
              type="button"
              onClick={handleExtract}
              disabled={extracting}
              className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs font-medium text-subtle hover:bg-surface-2 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {extracting ? "Extracting…" : meeting.extractedRequirements ? "Re-extract requirements" : "Extract requirements"}
            </button>
          )}
        </div>
        {extractUnavailable && (
          <p className="text-xs text-subtle">
            Transcript extraction isn&apos;t configured on this deployment.
          </p>
        )}
      </div>

      {meeting.extractedRequirements && (
        <p
          className={`rounded-md px-2.5 py-1.5 text-xs ${
            meeting.extractedRequirements.status === "pending_review"
              ? "bg-warning/10 text-warning"
              : "bg-line text-faint"
          }`}
        >
          {meeting.extractedRequirements.status === "pending_review"
            ? "Requirements suggested from this transcript — review in Discovery below."
            : "Transcript-derived requirements already reviewed."}
        </p>
      )}

      {actionError && <ErrorState error={actionError} />}
    </li>
  );
}

export function MeetingsSection({ leadId, role }: { leadId: string; role?: Role | null }) {
  // Scheduling authority is management-only (see .../meetings/index.js's
  // server-side MANAGEMENT_ROLES check, the authoritative enforcement).
  // This is a UX convenience only — while role hasn't loaded yet, default
  // to showing the form rather than flashing it away; the backend rejects
  // an unauthorized attempt regardless.
  const canManageSchedule = role == null || MANAGEMENT_ROLES.includes(role);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiErrorState | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<ApiErrorState | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await listMeetings(leadId);
      setMeetings(res.data);
      setLoadError(null);
    } catch (err) {
      setLoadError(describeApiError(err));
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduledAt) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      await createMeeting(leadId, { scheduledAt: new Date(scheduledAt).toISOString(), notes: notes.trim() || null });
      setScheduledAt("");
      setNotes("");
      setShowForm(false);
      await load();
    } catch (err) {
      setCreateError(describeApiError(err));
    } finally {
      setIsCreating(false);
    }
  }

  function handleUpdated(updated: Meeting) {
    setMeetings((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }
  if (loadError) return <ErrorState error={loadError} />;

  return (
    <div className="flex flex-col gap-4">
      {canManageSchedule ? (
        <div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-strong"
          >
            <Plus className="h-3.5 w-3.5" />
            Schedule Meeting
          </button>
        </div>
      ) : (
        <p className="text-xs text-subtle">
          Only a manager or admin can schedule a meeting for this lead.
        </p>
      )}

      {showForm && canManageSchedule && (
        <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-md border border-line p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-subtle">When</span>
              <input
                type="datetime-local"
                required
                className={inputClass}
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-subtle">Notes (optional)</span>
              <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>
          {createError && <ErrorState error={createError} />}
          <div>
            <button
              type="submit"
              disabled={isCreating || !scheduledAt}
              className="rounded-md border border-line px-3 py-1.5 text-sm text-subtle hover:bg-surface-2 disabled:opacity-50"
            >
              {isCreating ? "Scheduling…" : "Confirm"}
            </button>
          </div>
        </form>
      )}

      {meetings.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No meetings scheduled yet."
          description="A meeting is optional — Discovery and Find Rooms work without one."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {meetings.map((m) => (
            <MeetingCard key={m.id} meeting={m} onUpdated={handleUpdated} canManageSchedule={canManageSchedule} />
          ))}
        </ul>
      )}
    </div>
  );
}
