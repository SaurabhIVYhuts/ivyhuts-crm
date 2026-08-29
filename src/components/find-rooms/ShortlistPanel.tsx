"use client";

import { AlertTriangle, CheckCircle2, ExternalLink, Star, Trash2 } from "lucide-react";
import type { Dispatch } from "react";
import { formatCriteriaSummary, formatDistanceKm, formatRent } from "@/lib/findRooms/format";
import type { ShortlistAction, ShortlistEntry } from "@/lib/findRooms/shortlist";
import type { SearchedCriteriaSnapshot } from "@/lib/findRooms/staleness";
import { PROPERTY_SOURCE_LABELS } from "@/types/property";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import type { ApiErrorState } from "@/lib/utils/errors";

export type ShortlistSaveState = "idle" | "saving" | "saved" | "error";

function SaveStatusIndicator({ saveState, hasUnsavedChanges }: { saveState: ShortlistSaveState; hasUnsavedChanges: boolean }) {
  if (saveState === "saving") {
 return <span className="text-xs text-subtle dark:text-faint">Saving…</span>;
  }
  if (saveState === "error") {
    return (
 <span className="flex items-center gap-1 text-xs text-danger dark:text-danger">
 <AlertTriangle className="h-3.5 w-3.5" />
        Save failed
      </span>
    );
  }
  if (hasUnsavedChanges) {
 return <span className="text-xs text-warning dark:text-warning">Unsaved changes</span>;
  }
  if (saveState === "saved") {
    return (
 <span className="flex items-center gap-1 text-xs text-success dark:text-success">
 <CheckCircle2 className="h-3.5 w-3.5" />
        Saved
      </span>
    );
  }
  return null;
}

// Presentation handoff — Milestone 23.5 Part 24 / 23.6 Part 19 / 23.8. The
// actual "Generate Presentation" action lives ONLY in the Presentation
// section further down the lead page (PresentationsSection.tsx, backed by a
// real POST /api/leads/:id/presentations) — never duplicated here, so there
// is exactly one place an agent generates a deck from, not two competing
// buttons. This stays a pointer, not a second entry point.
function PresentationHandoff({ shortlistCount, isSaved }: { shortlistCount: number; isSaved: boolean }) {
  return (
 <div className="rounded-md border border-dashed border-line p-3 text-sm dark:border-line">
      {isSaved ? (
 <p className="flex items-center gap-1.5 font-medium text-success dark:text-success">
 <CheckCircle2 className="h-4 w-4" />
          Shortlist saved — head to the Presentation section below to generate a deck from these options.
        </p>
      ) : (
 <p className="font-medium text-subtle dark:text-subtle">
          Shortlist ready — {shortlistCount} {shortlistCount === 1 ? "property" : "properties"}. Save it to generate a presentation from the Presentation section below.
        </p>
      )}
    </div>
  );
}

function ShortlistRow({ entry, dispatch }: { entry: ShortlistEntry; dispatch: Dispatch<ShortlistAction> }) {
  return (
 <li className="rounded-md border border-line p-3 dark:border-line">
 <div className="flex flex-wrap items-start justify-between gap-2">
 <div className="min-w-0">
 <div className="flex items-center gap-2">
 <span className="truncate text-sm font-semibold text-ink dark:text-ink">{entry.name}</span>
            {entry.url && (
 <a href={entry.url} target="_blank" rel="noreferrer" className="text-faint hover:text-subtle dark:hover:text-ink">
 <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
 <div className="text-xs text-subtle dark:text-faint">
            {PROPERTY_SOURCE_LABELS[entry.provider]} · {formatRent(entry.rent, entry.currency, entry.rentPeriod)} ·{" "}
            {formatDistanceKm(entry.distanceFromUniversityKm)}
          </div>
        </div>

 <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              dispatch(entry.isRecommended ? { type: "unmarkRecommended", propertyId: entry.propertyId } : { type: "markRecommended", propertyId: entry.propertyId })
            }
 className={
              entry.isRecommended
                ? "flex items-center gap-1 rounded-md bg-warning/10 px-2 py-1 text-xs font-medium text-warning dark:bg-warning/10 dark:text-warning"
                : "flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-subtle hover:bg-surface-2 dark:border-line dark:text-subtle dark:hover:bg-surface-2"
            }
          >
 <Star className="h-3.5 w-3.5" />
            {entry.isRecommended ? "Recommended" : "Mark as Recommended"}
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "remove", propertyId: entry.propertyId })}
 className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-subtle hover:bg-surface-2 dark:border-line dark:text-subtle dark:hover:bg-surface-2"
          >
 <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        </div>
      </div>

      {entry.isRecommended && (
 <div className="mt-3 flex flex-col gap-2 border-t border-warning/30 pt-3 dark:border-warning/30/40">
 <label className="flex flex-col gap-1">
 <span className="text-xs font-medium text-subtle dark:text-faint">Why this property?</span>
            <textarea
              rows={2}
              value={entry.recommendationReason}
              onChange={(e) => dispatch({ type: "updateNotes", propertyId: entry.propertyId, patch: { recommendationReason: e.target.value } })}
 className="rounded-md border border-line bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-accent dark:border-line"
            />
          </label>
 <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
 <label className="flex flex-col gap-1">
 <span className="text-xs font-medium text-subtle dark:text-faint">Advantages</span>
              <textarea
                rows={2}
                value={entry.advantages}
                onChange={(e) => dispatch({ type: "updateNotes", propertyId: entry.propertyId, patch: { advantages: e.target.value } })}
 className="rounded-md border border-line bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-accent dark:border-line"
              />
            </label>
 <label className="flex flex-col gap-1">
 <span className="text-xs font-medium text-subtle dark:text-faint">Disadvantages</span>
              <textarea
                rows={2}
                value={entry.disadvantages}
                onChange={(e) => dispatch({ type: "updateNotes", propertyId: entry.propertyId, patch: { disadvantages: e.target.value } })}
 className="rounded-md border border-line bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-accent dark:border-line"
              />
            </label>
          </div>
        </div>
      )}
    </li>
  );
}

export function ShortlistPanel({
  shortlist,
  dispatch,
  notes,
  onNotesChange,
  saveState,
  saveError,
  hasUnsavedChanges,
  hasEverSaved,
  onSave,
  isStaleVsSaved,
  savedCriteria,
  currentCriteria,
  onSearchAgain,
}: {
  shortlist: ShortlistEntry[];
  dispatch: Dispatch<ShortlistAction>;
  notes: string;
  onNotesChange: (notes: string) => void;
  saveState: ShortlistSaveState;
  saveError: ApiErrorState | null;
  hasUnsavedChanges: boolean;
  hasEverSaved: boolean;
  onSave: () => void;
  isStaleVsSaved: boolean;
  savedCriteria: SearchedCriteriaSnapshot | null;
  currentCriteria: SearchedCriteriaSnapshot;
  onSearchAgain: () => void;
}) {
  return (
    <div>
 <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
 <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle dark:text-faint">
          Your Shortlist{shortlist.length > 0 ? ` — ${shortlist.length} ${shortlist.length === 1 ? "property" : "properties"}` : ""}
        </h3>
        <SaveStatusIndicator saveState={saveState} hasUnsavedChanges={hasUnsavedChanges} />
      </div>

      {/* Requirements changed since this shortlist was last SAVED — distinct
          from CriteriaPanel's own "stale vs. last SEARCH" banner (Milestone
          23.5). Never auto-searches; only offers the same explicit action. */}
      {isStaleVsSaved && (
 <div className="mb-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm dark:border-warning/30 dark:bg-warning/10">
 <div className="flex items-center gap-2 font-medium text-warning dark:text-warning">
 <AlertTriangle className="h-4 w-4 shrink-0" />
            Requirements changed
          </div>
 <p className="mt-1 text-xs text-warning dark:text-warning">
            This shortlist was saved for: {formatCriteriaSummary(savedCriteria)}
            <br />
            Current requirements: {formatCriteriaSummary(currentCriteria)}
          </p>
          <button
            type="button"
            onClick={onSearchAgain}
 className="mt-2 rounded-md border border-warning/30 bg-surface px-3 py-1 text-xs font-medium text-warning hover:bg-warning/10 dark:border-warning/30 dark:bg-transparent dark:text-warning dark:hover:bg-warning/10"
          >
            Search Rooms Again
          </button>
        </div>
      )}

      {shortlist.length === 0 ? (
        <EmptyState title="No properties shortlisted yet." description="Add properties from the search results above." />
      ) : (
        <>
 <ul className="flex flex-col gap-2">
            {shortlist.map((entry) => (
              <ShortlistRow key={entry.propertyId} entry={entry} dispatch={dispatch} />
            ))}
          </ul>

 <label className="mt-3 flex flex-col gap-1">
 <span className="text-xs font-medium text-subtle dark:text-faint">Agent notes (optional)</span>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
 className="rounded-md border border-line bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-accent dark:border-line"
            />
          </label>

          {saveState === "error" && saveError && (
 <div className="mt-2">
              <ErrorState error={saveError} onRetry={onSave} />
            </div>
          )}

          {/* Explicit save only (Milestone 23.6 Part 16) — no autosave. */}
          <button
            type="button"
            onClick={onSave}
            disabled={saveState === "saving"}
 className="mt-3 rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50 "
          >
            {saveState === "saving" ? "Saving…" : "Save Shortlist"}
          </button>

 <div className="mt-3">
            <PresentationHandoff shortlistCount={shortlist.length} isSaved={hasEverSaved && !hasUnsavedChanges} />
          </div>
        </>
      )}
    </div>
  );
}
