"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Pencil, CheckCircle2, FileText, Sparkles } from "lucide-react";
import { getDiscovery, saveDiscovery } from "@/lib/api/discovery";
import { listMeetings, updateMeeting } from "@/lib/api/meetings";
import type { Discovery, DiscoveryInput, RequirementSource } from "@/types/discovery";
import { DISCOVERY_PRIORITY_FACTORS, type DiscoveryPriorityFactor } from "@/types/discovery";
import type { Meeting, ExtractedRequirements } from "@/types/meeting";
import { DiscoveryForm, PRIORITY_LABELS, type DiscoveryFormValues } from "@/components/discovery/DiscoveryForm";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { describeApiError, type ApiErrorState } from "@/lib/utils/errors";
import { formatDate, formatDateTime } from "@/lib/utils/format";

const BLANK_VALUES: DiscoveryFormValues = {
  university: "",
  universityResolved: null,
  course: "",
  intake: "",
  budgetMin: "",
  budgetMax: "",
  currency: "",
  moveInDate: "",
  stayDurationMonths: "",
  preferredLocation: "",
  roomPreference: "",
  sharing: "",
  distancePreference: "",
  priorities: [],
  notes: "",
  requirementSources: { university: null, budget: null, sharing: null },
};

const SOURCE_LABELS: Record<RequirementSource, string> = {
  lead_form: "Lead form",
  agent: "Agent",
  meeting: "Meeting",
  transcript: "Transcript",
};

function SourceTag({ source }: { source: RequirementSource | null }) {
  if (!source) return null;
  return (
 <span className="ml-1 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-subtle dark:bg-surface-2 dark:text-faint">
      {SOURCE_LABELS[source]}
    </span>
  );
}

function toFormValues(discovery: Discovery | null): DiscoveryFormValues {
  if (!discovery) return BLANK_VALUES;
  return {
    university: discovery.student.university ?? "",
    universityResolved: discovery.student.universityResolved,
    course: discovery.student.course ?? "",
    intake: discovery.student.intake ?? "",
    budgetMin: discovery.accommodation.budgetMin?.toString() ?? "",
    budgetMax: discovery.accommodation.budgetMax?.toString() ?? "",
    currency: discovery.accommodation.currency ?? "",
    moveInDate: discovery.accommodation.moveInDate ? discovery.accommodation.moveInDate.slice(0, 10) : "",
    stayDurationMonths: discovery.accommodation.stayDurationMonths?.toString() ?? "",
    preferredLocation: discovery.accommodation.preferredLocation ?? "",
    roomPreference: discovery.accommodation.roomPreference ?? "",
    sharing: discovery.accommodation.sharing?.toString() ?? "",
    distancePreference: discovery.accommodation.distancePreference ?? "",
    priorities: discovery.priorities,
    notes: discovery.notes ?? "",
    requirementSources: discovery.requirementSources,
  };
}

function toPayload(values: DiscoveryFormValues): DiscoveryInput {
  const str = (v: string) => (v.trim() === "" ? null : v.trim());
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  return {
    student: {
      university: str(values.university),
      universityResolved: values.universityResolved,
      course: str(values.course),
      intake: str(values.intake),
    },
    accommodation: {
      budgetMin: num(values.budgetMin),
      budgetMax: num(values.budgetMax),
      currency: str(values.currency),
      moveInDate: values.moveInDate === "" ? null : values.moveInDate,
      stayDurationMonths: num(values.stayDurationMonths),
      preferredLocation: str(values.preferredLocation),
      roomPreference: str(values.roomPreference),
      sharing: num(values.sharing),
      distancePreference: str(values.distancePreference),
    },
    priorities: values.priorities,
    notes: str(values.notes),
    requirementSources: values.requirementSources,
  };
}

function formatBudget(min: number | null, max: number | null, currency: string | null): string {
  const c = currency ? `${currency} ` : "";
  if (min == null && max == null) return "—";
  if (min != null && max != null) return `${c}${min} – ${max}`;
  if (min != null) return `${c}${min}+`;
  return `Up to ${c}${max}`;
}

function hasAnyAccommodationInfo(discovery: Discovery): boolean {
  const a = discovery.accommodation;
  return Boolean(
    a.budgetMin || a.budgetMax || a.moveInDate || a.stayDurationMonths || a.preferredLocation || a.roomPreference || a.sharing || a.distancePreference
  );
}

function hasAnyStudentInfo(discovery: Discovery): boolean {
  const s = discovery.student;
  return Boolean(s.university || s.course || s.intake);
}

// Milestone 23.16 — true only for a field the transcript actually supported
// (extraction non-null); "budget" is true if ANY of budgetMin/budgetMax/
// currency is non-null, matching requirementSources' single "budget" key
// covering all three underlying fields.
function touchedByExtraction(extracted: ExtractedRequirements) {
  return {
    university: extracted.university != null,
    course: extracted.course != null,
    intake: extracted.intake != null,
    budget: extracted.budgetMin != null || extracted.budgetMax != null || extracted.currency != null,
    moveInDate: extracted.moveInDate != null,
    stayDurationMonths: extracted.stayDurationMonths != null,
    preferredLocation: extracted.preferredLocation != null,
    roomPreference: extracted.roomPreference != null,
    sharing: extracted.sharing != null,
    distancePreference: extracted.distancePreference != null,
    priorities: extracted.priorities.length > 0,
    notes: extracted.notes != null,
  };
}

// Milestone 23.14, fixed 23.16 — maps a meeting's AI-extracted SUGGESTION
// onto a Discovery PUT body for "Confirm All". Discovery's PUT is a PARTIAL
// dot-path merge where an OMITTED key is left untouched and an explicitly
// present (even null) key CLEARS it (see src/types/discovery.ts's
// DiscoveryInput comment, and api/leads/[id]/discovery.js's
// mergeAndCollectSetPaths). The 23.14 version always sent every key —
// including ones the transcript never mentioned, honestly null on the
// extraction — which the backend then read as "clear this field",
// silently wiping any already-confirmed budget/sharing/move-in-date/etc.
// whenever a later transcript only re-confirmed part of Discovery. Fixed by
// only ever including a key here when the transcript actually supported it;
// everything else is omitted so the backend's own merge preserves it.
// Exported for direct unit testing (src/components/discovery/__tests__/
// extractionMerge.test.ts) — same "no jsdom/RTL in this repo, test the pure
// derivation directly" convention as SalesJourney.tsx's buildStages/
// deriveNextAction exports.
export function extractionToPayload(extracted: ExtractedRequirements): DiscoveryInput {
  const touched = touchedByExtraction(extracted);
  const priorities = extracted.priorities.filter((p): p is DiscoveryPriorityFactor =>
    (DISCOVERY_PRIORITY_FACTORS as readonly string[]).includes(p)
  );

  const student: DiscoveryInput["student"] = {};
  if (touched.university) student.university = extracted.university;
  if (touched.course) student.course = extracted.course;
  if (touched.intake) student.intake = extracted.intake;

  const accommodation: DiscoveryInput["accommodation"] = {};
  if (extracted.budgetMin != null) accommodation.budgetMin = extracted.budgetMin;
  if (extracted.budgetMax != null) accommodation.budgetMax = extracted.budgetMax;
  if (extracted.currency != null) accommodation.currency = extracted.currency;
  if (touched.moveInDate) accommodation.moveInDate = extracted.moveInDate;
  if (touched.stayDurationMonths) accommodation.stayDurationMonths = extracted.stayDurationMonths;
  if (touched.preferredLocation) accommodation.preferredLocation = extracted.preferredLocation;
  if (touched.roomPreference) accommodation.roomPreference = extracted.roomPreference;
  if (touched.sharing) accommodation.sharing = extracted.sharing;
  if (touched.distancePreference) accommodation.distancePreference = extracted.distancePreference;

  const requirementSources: DiscoveryInput["requirementSources"] = {};
  if (touched.university) requirementSources.university = "transcript";
  if (touched.budget) requirementSources.budget = "transcript";
  if (touched.sharing) requirementSources.sharing = "transcript";

  const payload: DiscoveryInput = {};
  if (Object.keys(student).length > 0) payload.student = student;
  if (Object.keys(accommodation).length > 0) payload.accommodation = accommodation;
  if (Object.keys(requirementSources).length > 0) payload.requirementSources = requirementSources;
  // An empty extraction priorities[] means "the transcript didn't clearly
  // state any" (see transcriptExtraction.js), never "confirm zero
  // priorities" — omitted, not sent as [], so an existing set survives.
  if (touched.priorities) payload.priorities = priorities;
  if (touched.notes) payload.notes = extracted.notes;
  return payload;
}

// Fills in a field from the extraction when the transcript actually
// supported it, otherwise falls back to Discovery's own already-confirmed
// value — so "Review & Edit" shows the true EFFECTIVE result of confirming
// (existing data preserved + new suggestions layered on top), never a form
// that looks like it's about to blank out fields the transcript simply
// didn't repeat.
function pick<T>(fromExtraction: T | null, fromDiscovery: T | null | undefined): T | null {
  return fromExtraction != null ? fromExtraction : (fromDiscovery ?? null);
}

export function extractionToFormValues(extracted: ExtractedRequirements, discovery: Discovery | null): DiscoveryFormValues {
  const touched = touchedByExtraction(extracted);
  const priorities = touched.priorities
    ? extracted.priorities.filter((p): p is DiscoveryPriorityFactor => (DISCOVERY_PRIORITY_FACTORS as readonly string[]).includes(p))
    : (discovery?.priorities ?? []);
  const existingSources = discovery?.requirementSources;

  return {
    university: pick(extracted.university, discovery?.student.university) ?? "",
    // A newly-suggested university text invalidates any OLD resolved
    // snapshot (it was resolved against a different name) — never carried
    // forward in that case, same as the pre-23.16 behavior for a fresh
    // extraction; only preserved when this field itself falls back to the
    // existing, still-accurate Discovery value.
    universityResolved: touched.university ? null : (discovery?.student.universityResolved ?? null),
    course: pick(extracted.course, discovery?.student.course) ?? "",
    intake: pick(extracted.intake, discovery?.student.intake) ?? "",
    budgetMin: pick(extracted.budgetMin, discovery?.accommodation.budgetMin)?.toString() ?? "",
    budgetMax: pick(extracted.budgetMax, discovery?.accommodation.budgetMax)?.toString() ?? "",
    currency: pick(extracted.currency, discovery?.accommodation.currency) ?? "",
    moveInDate: pick(extracted.moveInDate, discovery?.accommodation.moveInDate) ?? "",
    stayDurationMonths: pick(extracted.stayDurationMonths, discovery?.accommodation.stayDurationMonths)?.toString() ?? "",
    preferredLocation: pick(extracted.preferredLocation, discovery?.accommodation.preferredLocation) ?? "",
    roomPreference: pick(extracted.roomPreference, discovery?.accommodation.roomPreference) ?? "",
    sharing: pick(extracted.sharing, discovery?.accommodation.sharing)?.toString() ?? "",
    distancePreference: pick(extracted.distancePreference, discovery?.accommodation.distancePreference) ?? "",
    priorities,
    notes: pick(extracted.notes, discovery?.notes) ?? "",
    requirementSources: {
      university: touched.university ? "transcript" : (existingSources?.university ?? null),
      budget: touched.budget ? "transcript" : (existingSources?.budget ?? null),
      sharing: touched.sharing ? "transcript" : (existingSources?.sharing ?? null),
    },
  };
}

const EXTRACTION_FIELD_LABELS: { key: keyof ExtractedRequirements; label: string }[] = [
  { key: "university", label: "University" },
  { key: "course", label: "Course" },
  { key: "intake", label: "Intake" },
  { key: "moveInDate", label: "Move-in date" },
  { key: "stayDurationMonths", label: "Stay duration" },
  { key: "roomPreference", label: "Room preference" },
  { key: "sharing", label: "Sharing" },
  { key: "preferredLocation", label: "Preferred location" },
  { key: "distancePreference", label: "Distance preference" },
];

function formatExtractedValue(extracted: ExtractedRequirements, key: keyof ExtractedRequirements): string {
  if (key === "sharing") return extracted.sharing != null ? String(extracted.sharing) : "—";
  if (key === "stayDurationMonths") return extracted.stayDurationMonths != null ? `${extracted.stayDurationMonths} months` : "—";
  const value = extracted[key];
  return typeof value === "string" && value ? value : "—";
}

export function DiscoverySection({ leadId }: { leadId: string }) {
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [loadError, setLoadError] = useState<ApiErrorState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [formValues, setFormValues] = useState<DiscoveryFormValues>(BLANK_VALUES);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<ApiErrorState | null>(null);

  // Milestone 23.10 Part 8 — an honest prompt, shown only when a meeting has
  // a transcript reference marked available with no AI suggestion attached
  // (e.g. an agent linked an external transcript without pasting text/
  // extracting). Superseded below by the richer Agent Review panel whenever
  // a real suggestion exists. Fetched independently of the Meeting section
  // above it, same "each section owns its own data" convention every other
  // Lead Detail section already follows.
  const [hasAvailableTranscript, setHasAvailableTranscript] = useState(false);
  // Milestone 23.14 — the most recent meeting with a transcript-derived
  // suggestion still awaiting agent review. This is a SUGGESTION only;
  // nothing here is written to Discovery until the agent explicitly
  // confirms it via the existing PUT below.
  const [reviewMeeting, setReviewMeeting] = useState<Meeting | null>(null);
  const [reviewActionError, setReviewActionError] = useState<ApiErrorState | null>(null);
  const [confirmingAll, setConfirmingAll] = useState(false);

  const loadMeetingsSignal = useCallback(() => {
    let cancelled = false;
    listMeetings(leadId)
      .then((res) => {
        if (cancelled) return;
        setHasAvailableTranscript(res.data.some((m) => m.transcriptStatus === "available"));
        const pending = res.data
          .filter((m) => m.extractedRequirements?.status === "pending_review")
          .sort((a, b) => new Date(b.extractedRequirements!.extractedAt).getTime() - new Date(a.extractedRequirements!.extractedAt).getTime());
        setReviewMeeting(pending[0] ?? null);
      })
      .catch(() => {
        // Non-critical — the banner/panel just doesn't show if this fails;
        // never block Discovery itself on the Meetings fetch.
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  useEffect(() => {
    let cancelled = false;
    getDiscovery(leadId)
      .then((res) => {
        if (!cancelled) setDiscovery(res.data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(describeApiError(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    const cancelMeetings = loadMeetingsSignal();
    return () => {
      cancelled = true;
      cancelMeetings();
    };
  }, [leadId, loadMeetingsSignal]);

  // Only the "Review & Edit" path (below) should mark the source meeting's
  // suggestion reviewed on save — a coincidental unrelated Discovery edit
  // made while a suggestion happens to be pending must never silently
  // dismiss it.
  const [isReviewingSuggestion, setIsReviewingSuggestion] = useState(false);

  function startEditing() {
    setFormValues(toFormValues(discovery));
    setSaveState("idle");
    setSaveError(null);
    setIsReviewingSuggestion(false);
    setIsEditing(true);
  }

  function startReviewEdit() {
    if (!reviewMeeting?.extractedRequirements) return;
    setFormValues(extractionToFormValues(reviewMeeting.extractedRequirements, discovery));
    setSaveState("idle");
    setSaveError(null);
    setIsReviewingSuggestion(true);
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setIsReviewingSuggestion(false);
    setSaveState("idle");
    setSaveError(null);
  }

  // The second half of confirming a suggestion — marks the meeting's
  // extraction reviewed so it stops surfacing as pending forever (see
  // src/types/meeting.ts's UpdateMeetingInput comment). Best-effort: the
  // Discovery save already succeeded by the time this runs, so a failure
  // here is surfaced but never rolled back.
  async function markSourceMeetingReviewed(meetingId: string) {
    try {
      await updateMeeting(leadId, meetingId, { markExtractedRequirementsReviewed: true });
      loadMeetingsSignal();
    } catch (err) {
      setReviewActionError(describeApiError(err));
    }
  }

  async function handleSave() {
    setSaveState("saving");
    setSaveError(null);
    const wasReviewingMeetingId = isReviewingSuggestion ? reviewMeeting?.id ?? null : null;
    try {
      const res = await saveDiscovery(leadId, toPayload(formValues));
      setDiscovery(res.data);
      setIsEditing(false);
      setIsReviewingSuggestion(false);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
      if (wasReviewingMeetingId) await markSourceMeetingReviewed(wasReviewingMeetingId);
    } catch (err) {
      setSaveState("error");
      setSaveError(describeApiError(err));
    }
  }

  async function handleConfirmAll() {
    if (!reviewMeeting?.extractedRequirements) return;
    setConfirmingAll(true);
    setReviewActionError(null);
    try {
      const res = await saveDiscovery(leadId, extractionToPayload(reviewMeeting.extractedRequirements));
      setDiscovery(res.data);
      await markSourceMeetingReviewed(reviewMeeting.id);
    } catch (err) {
      setReviewActionError(describeApiError(err));
    } finally {
      setConfirmingAll(false);
    }
  }

  if (isLoading) {
    return (
 <div className="flex flex-col gap-2">
 <Skeleton className="h-4 w-32" />
 <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (loadError) {
    return <ErrorState error={loadError} />;
  }

  if (isEditing) {
    return (
 <div className="flex flex-col gap-4">
        <DiscoveryForm values={formValues} onChange={setFormValues} disabled={saveState === "saving"} />
        {saveState === "error" && saveError && <ErrorState error={saveError} />}
 <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saveState === "saving"}
 className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50 "
          >
            {saveState === "saving" ? "Saving…" : "Save Discovery"}
          </button>
          <button
            type="button"
            onClick={cancelEditing}
            disabled={saveState === "saving"}
 className="rounded-md border border-line px-4 py-1.5 text-sm text-subtle hover:bg-surface-2 disabled:opacity-50 dark:border-line dark:text-subtle dark:hover:bg-surface-2"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // The passive banner only covers a transcript with no real suggestion
  // attached — the richer review panel below supersedes it whenever an
  // actual AI-extracted suggestion exists.
  const transcriptBanner = !reviewMeeting && hasAvailableTranscript && (
 <div className="flex items-center gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning dark:bg-warning/10 dark:text-warning">
 <FileText className="h-4 w-4 shrink-0" />
      Transcript available — requirements require agent confirmation.
    </div>
  );

  // Milestone 23.14 Part 19 — "Requirements discovered from meeting". Every
  // value shown here is a SUGGESTION only; nothing is written to Discovery
  // until the agent picks Confirm All or saves via Review & Edit. The agent
  // remains the final authority.
  const reviewPanel = reviewMeeting?.extractedRequirements && (
 <div className="flex flex-col gap-3 rounded-md border border-warning/30 bg-warning/10 p-3 dark:border-warning/30 dark:bg-warning/10">
 <div className="flex items-center gap-1.5 text-sm font-medium text-warning dark:text-warning">
 <Sparkles className="h-4 w-4" />
        Requirements discovered from meeting
      </div>
 <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {EXTRACTION_FIELD_LABELS.map(({ key, label }) => (
          <div key={key}>
 <dt className="text-xs text-subtle dark:text-faint">{label}</dt>
 <dd className="text-sm text-ink dark:text-ink">
              {formatExtractedValue(reviewMeeting.extractedRequirements!, key)}
 <span className="ml-1 rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-warning dark:bg-warning/10 dark:text-warning">
                Suggested from transcript
              </span>
            </dd>
          </div>
        ))}
        <div>
 <dt className="text-xs text-subtle dark:text-faint">Budget</dt>
 <dd className="text-sm text-ink dark:text-ink">
            {formatBudget(reviewMeeting.extractedRequirements.budgetMin, reviewMeeting.extractedRequirements.budgetMax, reviewMeeting.extractedRequirements.currency)}
 <span className="ml-1 rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-warning dark:bg-warning/10 dark:text-warning">
              Suggested from transcript
            </span>
          </dd>
        </div>
      </dl>
      {reviewMeeting.extractedRequirements.priorities.length > 0 && (
        <div>
 <dt className="text-xs text-subtle dark:text-faint">Priorities</dt>
 <dd className="mt-1 flex flex-wrap gap-1.5">
            {reviewMeeting.extractedRequirements.priorities.map((p) => (
 <span key={p} className="rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning dark:bg-warning/10 dark:text-warning">
                {p}
              </span>
            ))}
          </dd>
        </div>
      )}
      {reviewMeeting.extractedRequirements.notes && (
        <div>
 <dt className="text-xs text-subtle dark:text-faint">Notes</dt>
 <dd className="whitespace-pre-wrap text-sm text-ink dark:text-ink">{reviewMeeting.extractedRequirements.notes}</dd>
        </div>
      )}
      {reviewActionError && <ErrorState error={reviewActionError} />}
 <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleConfirmAll}
          disabled={confirmingAll}
 className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50 "
        >
          {confirmingAll ? "Confirming…" : "Confirm All"}
        </button>
        <button
          type="button"
          onClick={startReviewEdit}
          disabled={confirmingAll}
 className="rounded-md border border-line px-3 py-1.5 text-sm text-subtle hover:bg-surface-2 disabled:opacity-50 dark:border-line dark:text-subtle dark:hover:bg-surface-2"
        >
          Review & Edit
        </button>
      </div>
    </div>
  );

  if (!discovery) {
    return (
 <div className="flex flex-col gap-3">
        {reviewPanel}
        {transcriptBanner}
        <EmptyState
          icon={Search}
          title="Discovery has not been completed for this lead yet."
          description="Capture the student's requirements during the sales conversation."
          action={
            <button
              type="button"
              onClick={startEditing}
 className="mt-2 rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-strong "
            >
              Start Discovery
            </button>
          }
        />
      </div>
    );
  }

  return (
 <div className="flex flex-col gap-4">
      {reviewPanel}
      {transcriptBanner}
      {saveState === "saved" && (
 <div className="flex items-center gap-1.5 text-sm text-success dark:text-success">
 <CheckCircle2 className="h-4 w-4" />
          Discovery saved.
        </div>
      )}

 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
 <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle dark:text-faint">
            Student
          </h3>
          {hasAnyStudentInfo(discovery) ? (
 <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
 <dt className="text-xs text-subtle dark:text-faint">University</dt>
 <dd className="text-ink dark:text-ink">
                  {discovery.student.university || "—"}
                  <SourceTag source={discovery.requirementSources.university} />
                  {discovery.student.universityResolved && (
 <span className="ml-1 text-xs text-success dark:text-success">
                      ({[discovery.student.universityResolved.city, discovery.student.universityResolved.country].filter(Boolean).join(", ") || "resolved"})
                    </span>
                  )}
                  {discovery.student.university && !discovery.student.universityResolved && (
 <span className="ml-1 text-xs text-warning dark:text-warning">(not resolved)</span>
                  )}
                </dd>
              </div>
              <div>
 <dt className="text-xs text-subtle dark:text-faint">Course</dt>
 <dd className="text-ink dark:text-ink">{discovery.student.course || "—"}</dd>
              </div>
              <div>
 <dt className="text-xs text-subtle dark:text-faint">Intake</dt>
 <dd className="text-ink dark:text-ink">{discovery.student.intake || "—"}</dd>
              </div>
            </dl>
          ) : (
 <p className="text-sm text-subtle dark:text-faint">Not captured yet.</p>
          )}
        </div>

        <div>
 <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle dark:text-faint">
            Accommodation
          </h3>
          {hasAnyAccommodationInfo(discovery) ? (
 <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
 <dt className="text-xs text-subtle dark:text-faint">Budget</dt>
 <dd className="text-ink dark:text-ink">
                  {formatBudget(discovery.accommodation.budgetMin, discovery.accommodation.budgetMax, discovery.accommodation.currency)}
                  <SourceTag source={discovery.requirementSources.budget} />
                </dd>
              </div>
              <div>
 <dt className="text-xs text-subtle dark:text-faint">Sharing</dt>
 <dd className="text-ink dark:text-ink">
                  {discovery.accommodation.sharing != null
                    ? discovery.accommodation.sharing === 1
                      ? "Private / single"
                      : `${discovery.accommodation.sharing} sharing`
                    : "—"}
                  <SourceTag source={discovery.requirementSources.sharing} />
                </dd>
              </div>
              <div>
 <dt className="text-xs text-subtle dark:text-faint">Move-in date</dt>
 <dd className="text-ink dark:text-ink">
                  {formatDate(discovery.accommodation.moveInDate)}
                </dd>
              </div>
              <div>
 <dt className="text-xs text-subtle dark:text-faint">Stay duration</dt>
 <dd className="text-ink dark:text-ink">
                  {discovery.accommodation.stayDurationMonths != null
                    ? `${discovery.accommodation.stayDurationMonths} months`
                    : "—"}
                </dd>
              </div>
              <div>
 <dt className="text-xs text-subtle dark:text-faint">Preferred location</dt>
 <dd className="text-ink dark:text-ink">
                  {discovery.accommodation.preferredLocation || "—"}
                </dd>
              </div>
              <div>
 <dt className="text-xs text-subtle dark:text-faint">Room preference</dt>
 <dd className="text-ink dark:text-ink">
                  {discovery.accommodation.roomPreference || "—"}
                </dd>
              </div>
              <div>
 <dt className="text-xs text-subtle dark:text-faint">Distance preference</dt>
 <dd className="text-ink dark:text-ink">
                  {discovery.accommodation.distancePreference || "—"}
                </dd>
              </div>
            </dl>
          ) : (
 <p className="text-sm text-subtle dark:text-faint">Not captured yet.</p>
          )}
        </div>
      </div>

      <div>
 <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle dark:text-faint">
          Priorities
        </h3>
        {discovery.priorities.length > 0 ? (
 <div className="flex flex-wrap gap-1.5">
            {discovery.priorities.map((p) => (
              <span
                key={p}
 className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-subtle dark:bg-surface-2 dark:text-subtle"
              >
                {PRIORITY_LABELS[p]}
              </span>
            ))}
          </div>
        ) : (
 <p className="text-sm text-subtle dark:text-faint">Not captured yet.</p>
        )}
      </div>

      <div>
 <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle dark:text-faint">
          Requirements / Notes
        </h3>
 <p className="whitespace-pre-wrap text-sm text-subtle dark:text-subtle">
          {discovery.notes || "—"}
        </p>
      </div>

 <div className="flex items-center justify-between border-t border-line-soft pt-3 dark:border-line">
 <span className="text-xs text-subtle dark:text-faint">
          Last updated {formatDateTime(discovery.updatedAt)}
        </span>
        <button
          type="button"
          onClick={startEditing}
 className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-subtle hover:bg-surface-2 dark:border-line dark:text-subtle dark:hover:bg-surface-2"
        >
 <Pencil className="h-3.5 w-3.5" />
          Edit Discovery
        </button>
      </div>
    </div>
  );
}
