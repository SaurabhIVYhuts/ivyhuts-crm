"use client";

import { AlertTriangle, HelpCircle, MapPin, Search } from "lucide-react";
import type { FindRoomsFilters } from "@/lib/findRooms/buildCriteria";
import { formatSharing } from "@/lib/findRooms/format";
import type { FindRoomsRequirements } from "@/lib/findRooms/requirements";
import type { ResolvedUniversity } from "@/types/university";

// Discovery now captures currency explicitly (Milestone 23.7) — shown when
// present; omitted (never guessed, e.g. assumed GBP) when a legacy record
// has budget without currency.
function formatBudgetRange(min: number | null, max: number | null, currency: string | null): string {
  const c = currency ? `${currency} ` : "";
  if (min != null && max != null) return `${c}${min} – ${max} / week`;
  if (min != null) return `${c}${min}+ / week`;
  if (max != null) return `Up to ${c}${max} / week`;
  return "—";
}

export function CriteriaPanel({
  requirements,
  resolvedUniversity,
  isResolvingUniversity,
  filters,
  onFiltersChange,
  onSearch,
  isSearching,
  isStale,
}: {
  requirements: FindRoomsRequirements;
  resolvedUniversity: ResolvedUniversity | null;
  isResolvingUniversity: boolean;
  filters: FindRoomsFilters;
  onFiltersChange: (filters: FindRoomsFilters) => void;
  onSearch: () => void;
  isSearching: boolean;
  isStale: boolean;
}) {
  function setField<K extends keyof FindRoomsFilters>(key: K, value: FindRoomsFilters[K]) {
    onFiltersChange({ ...filters, [key]: value });
  }

  return (
 <div className="rounded-lg border border-line p-4 dark:border-line">
      {isStale && (
 <div className="mb-3 flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning dark:border-warning/30 dark:bg-warning/10 dark:text-warning">
 <AlertTriangle className="h-4 w-4 shrink-0" />
          Requirements changed. Search again to refresh property results.
        </div>
      )}

 <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
 <div className="text-xs font-semibold uppercase tracking-wide text-subtle dark:text-faint">University</div>
          {isResolvingUniversity ? (
 <div className="mt-1 text-sm text-subtle dark:text-faint">Resolving…</div>
          ) : resolvedUniversity ? (
 <div className="mt-1">
 <div className="flex items-center gap-1 text-sm font-medium text-ink dark:text-ink">
 <MapPin className="h-3.5 w-3.5 shrink-0 text-faint" />
                {resolvedUniversity.name}
              </div>
 <div className="text-xs text-subtle dark:text-faint">
                {[resolvedUniversity.city, resolvedUniversity.country].filter(Boolean).join(", ") || "—"}
              </div>
            </div>
          ) : (
 <div className="mt-1">
 <div className="text-sm font-medium text-ink dark:text-ink">{requirements.university}</div>
 <div className="text-xs text-subtle dark:text-faint">
                Could not resolve a known location — distance to properties will be unavailable.
              </div>
            </div>
          )}
        </div>

        <div>
 <div className="text-xs font-semibold uppercase tracking-wide text-subtle dark:text-faint">Budget</div>
 <div className="mt-1 text-sm font-medium text-ink dark:text-ink">
            {formatBudgetRange(requirements.budgetMin, requirements.budgetMax, requirements.currency)}
          </div>
        </div>

        <div>
 <div className="text-xs font-semibold uppercase tracking-wide text-subtle dark:text-faint">Sharing</div>
 <div className="mt-1 text-sm font-medium text-ink dark:text-ink">
            {formatSharing(requirements.sharing)}
          </div>
          {requirements.sharingSource === "derived" && (
 <div className="mt-0.5 flex items-center gap-1 text-xs text-warning dark:text-warning">
 <HelpCircle className="h-3.5 w-3.5 shrink-0" />
              Guessed from &quot;room preference&quot; — please confirm in Discovery.
            </div>
          )}
        </div>
      </div>

 <div className="mt-4 grid grid-cols-1 gap-3 border-t border-line-soft pt-4 dark:border-line sm:grid-cols-4">
 <label className="flex flex-col gap-1">
 <span className="text-xs font-medium text-subtle dark:text-faint">Room type (optional)</span>
          <input
            type="text"
            value={filters.roomType}
            onChange={(e) => setField("roomType", e.target.value)}
            placeholder="Any"
 className="rounded-md border border-line bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-accent dark:border-line"
          />
        </label>
 <label className="flex flex-col gap-1">
 <span className="text-xs font-medium text-subtle dark:text-faint">Move-in date (optional)</span>
          <input
            type="date"
            value={filters.moveInDate}
            onChange={(e) => setField("moveInDate", e.target.value)}
 className="rounded-md border border-line bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-accent dark:border-line"
          />
        </label>
 <label className="flex flex-col gap-1">
 <span className="text-xs font-medium text-subtle dark:text-faint">Stay duration, months (optional)</span>
          <input
            type="number"
            min={1}
            value={filters.stayDurationMonths}
            onChange={(e) => setField("stayDurationMonths", e.target.value)}
 className="rounded-md border border-line bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-accent dark:border-line"
          />
        </label>
 <label className="flex flex-col gap-1">
 <span className="text-xs font-medium text-subtle dark:text-faint">Max distance, km (optional)</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={filters.preferredDistance}
            onChange={(e) => setField("preferredDistance", e.target.value)}
 className="rounded-md border border-line bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-accent dark:border-line"
          />
        </label>
      </div>

 <label className="mt-3 flex flex-col gap-1">
 <span className="text-xs font-medium text-subtle dark:text-faint">Amenities, comma-separated (optional)</span>
        <input
          type="text"
          value={filters.amenities}
          onChange={(e) => setField("amenities", e.target.value)}
          placeholder="wifi, gym, laundry"
 className="rounded-md border border-line bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-accent dark:border-line"
        />
      </label>

      <button
        type="button"
        onClick={onSearch}
        disabled={isSearching}
 className="mt-4 flex items-center gap-1.5 rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50 "
      >
 <Search className="h-4 w-4" />
        {isSearching ? "Searching…" : isStale ? "Search again" : "Search Rooms"}
      </button>
    </div>
  );
}
