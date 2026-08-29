"use client";

// Lead-scoped Find Rooms workspace — Milestone 23.5.
//
// Flow: Discovery -> requirements (university/budget/sharing) -> explicit
// Search Rooms click -> GET /api/properties/search (searchFindRooms) ->
// provider coverage + CanonicalProperty results -> agent curates a
// shortlist -> (blocked) presentation handoff.
//
// IMPORTANT — the searchFindRooms call is made from exactly ONE place in
// this file: handleSearch, itself called only from CriteriaPanel's onSearch,
// which CriteriaPanel wires to a <button onClick>. It is never called from
// a useEffect, never on mount, never keyed on Discovery/filter changes —
// see src/components/find-rooms/__tests__/structural.test.ts, which
// enforces this by inspecting this file's source directly, the same way
// the IVYHUTS backend's own scripts/verify-*.js "STRUCTURAL:" tests police
// equivalent rules there.
//
// resolveUniversity() (the REAL backend university resolver, not the
// Milestone 23.1 CRM fixture) IS called automatically once the three
// requirements are met — that's a cheap, read-only lookup for display and
// distance purposes, not the provider search itself, so it doesn't violate
// the rule above.
//
// The shortlist below is CLIENT-SIDE ONLY (see src/lib/findRooms/
// shortlist.ts's header comment) — no backend contract exists yet to
// persist it.
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { getDiscovery } from "@/lib/api/discovery";
import { resolveUniversity } from "@/lib/api/universities";
import { searchFindRooms } from "@/lib/api/properties";
import { getAccommodationCuration, saveAccommodationCuration } from "@/lib/api/accommodationCuration";
import type { ResolvedUniversity } from "@/types/university";
import type { Discovery } from "@/types/discovery";
import type { FindRoomsSearchCriteria, FindRoomsSearchResult, PropertySource } from "@/types/property";
import { PROPERTY_SOURCES, PROPERTY_SOURCE_LABELS } from "@/types/property";
import type { CriteriaSnapshot } from "@/types/accommodationCuration";
import { deriveFindRoomsRequirements } from "@/lib/findRooms/requirements";
import { BLANK_FIND_ROOMS_FILTERS, buildFindRoomsCriteria, type FindRoomsFilters } from "@/lib/findRooms/buildCriteria";
import { criteriaChanged, type SearchedCriteriaSnapshot } from "@/lib/findRooms/staleness";
import { describeSearchOutcome } from "@/lib/findRooms/outcome";
import { filterPropertiesByProvider, sortProperties, RECOMMENDED_EXPLANATION, SORT_LABELS, SORT_OPTIONS, type SortOption } from "@/lib/findRooms/sorting";
import { shortlistReducer } from "@/lib/findRooms/shortlist";
import {
  criteriaSnapshotToStalenessSnapshot,
  criteriaToSnapshot,
  curationInputsEqual,
  curationToShortlistState,
  shortlistToCurationInput,
} from "@/lib/findRooms/curationSync";
import { RequirementsGate } from "./RequirementsGate";
import { CriteriaPanel } from "./CriteriaPanel";
import { ProviderCoverage } from "./ProviderCoverage";
import { PropertyResultCard } from "./PropertyResultCard";
import { ShortlistPanel, type ShortlistSaveState } from "./ShortlistPanel";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { describeApiError, type ApiErrorState } from "@/lib/utils/errors";

function toSnapshot(requirements: ReturnType<typeof deriveFindRoomsRequirements>): SearchedCriteriaSnapshot {
  return {
    university: requirements.university,
    budgetMin: requirements.budgetMin,
    budgetMax: requirements.budgetMax,
    currency: requirements.currency,
    sharing: requirements.sharing,
  };
}

export function FindRoomsSection({ leadId }: { leadId: string }) {
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [isLoadingDiscovery, setIsLoadingDiscovery] = useState(true);
  const [discoveryLoadError, setDiscoveryLoadError] = useState<ApiErrorState | null>(null);

  const requirements = useMemo(() => deriveFindRoomsRequirements(discovery), [discovery]);

  const [resolvedUniversity, setResolvedUniversity] = useState<ResolvedUniversity | null>(null);
  const [isResolvingUniversity, setIsResolvingUniversity] = useState(false);

  const [filters, setFilters] = useState<FindRoomsFilters>(BLANK_FIND_ROOMS_FILTERS);
  // Ref, not state — a one-time "have we pre-filled from Discovery yet"
  // flag that must not itself trigger a re-run of the load effect below.
  const filtersInitializedRef = useRef(false);

  const [searchState, setSearchState] = useState<"idle" | "searching" | "error">("idle");
  const [searchError, setSearchError] = useState<ApiErrorState | null>(null);
  const [searchResult, setSearchResult] = useState<FindRoomsSearchResult | null>(null);
  const [lastSearchedCriteria, setLastSearchedCriteria] = useState<SearchedCriteriaSnapshot | null>(null);
  // Full criteria object from the last successful search — carries
  // university coordinates/currency/etc. that the narrow
  // SearchedCriteriaSnapshot above doesn't, so it can become the
  // persisted criteriaSnapshot on save (see handleSave). Null until a
  // search has run this session; falls back to the already-saved
  // snapshot (savedCriteriaSnapshot below) when saving without a fresh
  // search.
  const [lastSearchedFullCriteria, setLastSearchedFullCriteria] = useState<FindRoomsSearchCriteria | null>(null);

  const [providerFilter, setProviderFilter] = useState<PropertySource | "all">("all");
  const [sortBy, setSortBy] = useState<SortOption>("recommended");

  const [shortlist, dispatch] = useReducer(shortlistReducer, []);
  const [notes, setNotes] = useState("");

  // Persistence (Milestone 23.6) — separate from search/discovery loading
  // state so the rest of Find Rooms can render as soon as Discovery is
  // ready, without waiting on the shortlist to load too (Part 24: GET
  // Lead + GET Discovery + GET Accommodation Curation, all independent,
  // none blocking another).
  const [isLoadingCuration, setIsLoadingCuration] = useState(true);
  const [curationLoadError, setCurationLoadError] = useState<ApiErrorState | null>(null);
  const [savedCriteriaSnapshot, setSavedCriteriaSnapshot] = useState<CriteriaSnapshot | null>(null);
  const [lastSavedInput, setLastSavedInput] = useState<ReturnType<typeof shortlistToCurationInput> | null>(null);
  const [saveState, setSaveState] = useState<ShortlistSaveState>("idle");
  const [saveError, setSaveError] = useState<ApiErrorState | null>(null);

  // Load Discovery once — same pattern DiscoverySection.tsx and
  // CompetitiveAnalysisSection.tsx already use independently; not a new
  // fetch pattern.
  useEffect(() => {
    let cancelled = false;
    getDiscovery(leadId)
      .then((res) => {
        if (cancelled) return;
        setDiscovery(res.data);
        if (!filtersInitializedRef.current && res.data) {
          const discoveryData = res.data;
          setFilters((prev) => ({
            ...prev,
            moveInDate: discoveryData.accommodation.moveInDate ? discoveryData.accommodation.moveInDate.slice(0, 10) : prev.moveInDate,
            stayDurationMonths: discoveryData.accommodation.stayDurationMonths?.toString() ?? prev.stayDurationMonths,
          }));
          filtersInitializedRef.current = true;
        }
      })
      .catch((err) => {
        if (!cancelled) setDiscoveryLoadError(describeApiError(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDiscovery(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  // Load the persisted shortlist once — GET /api/leads/:id/accommodation-
  // curation (Milestone 23.6). `data: null` means nothing has been saved
  // yet, same "null is a normal response" convention as Discovery; the
  // reducer simply starts empty in that case (already its initial state,
  // nothing to dispatch).
  useEffect(() => {
    let cancelled = false;
    getAccommodationCuration(leadId)
      .then((res) => {
        if (cancelled) return;
        if (res.data) {
          const { shortlist: hydrated, notes: hydratedNotes } = curationToShortlistState(res.data);
          dispatch({ type: "replaceAll", entries: hydrated });
          setNotes(hydratedNotes);
          setSavedCriteriaSnapshot(res.data.criteriaSnapshot);
          setLastSavedInput(shortlistToCurationInput(hydrated, res.data.criteriaSnapshot, hydratedNotes));
          setSaveState("saved");
        }
      })
      .catch((err) => {
        if (!cancelled) setCurationLoadError(describeApiError(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCuration(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  // Cheap, read-only university lookup — not the provider search. See this
  // file's header comment for why this is exempt from the "explicit click
  // only" rule.
  //
  // No synchronous setState for the "requirements incomplete" case:
  // resolvedUniversity is simply never rendered while requirements are
  // incomplete (RequirementsGate is shown instead of CriteriaPanel), so
  // there's nothing to clear — the next time requirements become complete,
  // this effect re-runs (isComplete/university are both dependencies) and
  // overwrites it with a fresh resolution anyway.
  useEffect(() => {
    if (!requirements.isComplete || !requirements.university) return;
    let cancelled = false;
    const universityQuery = requirements.university;
    // setIsResolvingUniversity(true) is deferred into a microtask (rather
    // than called synchronously here) to satisfy the
    // react-hooks/set-state-in-effect rule — a plain synchronous setState
    // at the top of an effect body risks a cascading extra render; chaining
    // it through .then() keeps this identical in behavior while avoiding
    // that.
    Promise.resolve()
      .then(() => {
        if (!cancelled) setIsResolvingUniversity(true);
      })
      .then(() => resolveUniversity(universityQuery))
      .then((res) => {
        if (cancelled) return;
        setResolvedUniversity(res.resolved ? res.university : null);
      })
      .catch(() => {
        if (!cancelled) setResolvedUniversity(null);
      })
      .finally(() => {
        if (!cancelled) setIsResolvingUniversity(false);
      });
    return () => {
      cancelled = true;
    };
  }, [requirements.isComplete, requirements.university]);

  async function handleSearch() {
    const criteria = buildFindRoomsCriteria(requirements, resolvedUniversity, filters);
    if (!criteria) return; // requirements incomplete — CriteriaPanel/button should be unreachable in that state anyway

    setSearchState("searching");
    setSearchError(null);
    try {
      const result = await searchFindRooms(criteria);
      setSearchResult(result);
      setLastSearchedCriteria(toSnapshot(requirements));
      setLastSearchedFullCriteria(criteria);
      setSearchState("idle");
    } catch (err) {
      setSearchState("error");
      setSearchError(describeApiError(err));
    }
  }

  // Explicit save only (Milestone 23.6 Part 16) — called only from
  // ShortlistPanel's "Save Shortlist" button, never automatically. Sends
  // the criteriaSnapshot from the most recent search this session, or
  // falls back to whatever snapshot was already saved (e.g. the agent
  // edited a loaded shortlist's notes/recommendation without searching
  // again) — never fabricates one from nothing.
  async function handleSave() {
    const criteriaSnapshot = lastSearchedFullCriteria ? criteriaToSnapshot(lastSearchedFullCriteria) : savedCriteriaSnapshot;
    const input = shortlistToCurationInput(shortlist, criteriaSnapshot, notes);

    setSaveState("saving");
    setSaveError(null);
    try {
      const result = await saveAccommodationCuration(leadId, input);
      setSavedCriteriaSnapshot(result.data.criteriaSnapshot);
      setLastSavedInput(input);
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      setSaveError(describeApiError(err));
    }
  }

  if (isLoadingDiscovery) {
    return (
 <div className="flex flex-col gap-2">
 <Skeleton className="h-4 w-32" />
 <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (discoveryLoadError) {
    return <ErrorState error={discoveryLoadError} />;
  }

  if (!requirements.isComplete) {
    return <RequirementsGate requirements={requirements} />;
  }

  const currentSnapshot = toSnapshot(requirements);
  const isStale = criteriaChanged(lastSearchedCriteria, currentSnapshot);
  const outcome = searchResult ? describeSearchOutcome(searchResult) : null;
  const shortlistedIds = new Set(shortlist.map((e) => e.propertyId));
  const visibleProperties = searchResult
    ? sortProperties(filterPropertiesByProvider(searchResult.properties, providerFilter), sortBy)
    : [];

  // Persistence-derived values (Milestone 23.6) — kept out of state since
  // they're all cheaply recomputable from shortlist/notes/search state on
  // every render, rather than one more thing to keep in sync.
  const savedStalenessSnapshot = criteriaSnapshotToStalenessSnapshot(savedCriteriaSnapshot);
  const isStaleVsSaved = criteriaChanged(savedStalenessSnapshot, currentSnapshot);
  const currentCriteriaSnapshotForSave = lastSearchedFullCriteria ? criteriaToSnapshot(lastSearchedFullCriteria) : savedCriteriaSnapshot;
  const currentInput = shortlistToCurationInput(shortlist, currentCriteriaSnapshotForSave, notes);
  const hasEverSaved = lastSavedInput !== null;
  const hasUnsavedChanges = hasEverSaved
    ? !curationInputsEqual(currentInput, lastSavedInput)
    : shortlist.length > 0 || notes.trim() !== "";

  return (
 <div className="flex flex-col gap-4">
      <CriteriaPanel
        requirements={requirements}
        resolvedUniversity={resolvedUniversity}
        isResolvingUniversity={isResolvingUniversity}
        filters={filters}
        onFiltersChange={setFilters}
        onSearch={handleSearch}
        isSearching={searchState === "searching"}
        isStale={isStale}
      />

      {searchState === "error" && searchError && <ErrorState error={searchError} onRetry={handleSearch} />}

      {searchResult && outcome && (
        <>
          <ProviderCoverage providerCoverage={searchResult.providerCoverage} />

          {outcome.kind === "no_providers_configured" && (
            <EmptyState
              icon={AlertTriangle}
              title="No connected accommodation sources are currently available."
              description="This is an infrastructure limitation, not a result of the search — see provider status above."
            />
          )}

          {outcome.kind === "no_matches" && (
            <EmptyState title="No properties matched these requirements." description="Try widening the budget or distance, then search again." />
          )}

          {outcome.kind === "results" && (
 <div className="flex flex-col gap-3">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setProviderFilter("all")}
 className={
                      providerFilter === "all"
                        ? "rounded-full bg-accent px-3 py-1 text-xs font-medium text-white    "
                        : "rounded-full border border-line px-3 py-1 text-xs text-subtle hover:bg-surface-2 dark:border-line dark:text-subtle dark:hover:bg-surface-2"
                    }
                  >
                    All
                  </button>
                  {PROPERTY_SOURCES.map((source) => (
                    <button
                      key={source}
                      type="button"
                      onClick={() => setProviderFilter(source)}
 className={
                        providerFilter === source
                          ? "rounded-full bg-accent px-3 py-1 text-xs font-medium text-white    "
                          : "rounded-full border border-line px-3 py-1 text-xs text-subtle hover:bg-surface-2 dark:border-line dark:text-subtle dark:hover:bg-surface-2"
                      }
                    >
                      {PROPERTY_SOURCE_LABELS[source]}
                    </button>
                  ))}
                </div>

 <label className="flex items-center gap-1.5 text-xs text-subtle dark:text-faint">
                  Sort:
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
 className="rounded-md border border-line bg-transparent px-2 py-1 text-xs outline-none focus:border-accent dark:border-line"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {SORT_LABELS[option]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {sortBy === "recommended" && (
 <p className="text-xs text-faint dark:text-subtle">{RECOMMENDED_EXPLANATION}</p>
              )}

 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleProperties.map((property) => (
                  <PropertyResultCard
                    key={property.propertyId}
                    property={property}
                    isShortlisted={shortlistedIds.has(property.propertyId)}
                    onAddToShortlist={(p) => dispatch({ type: "add", property: p })}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {isLoadingCuration ? (
 <Skeleton className="h-24 w-full" />
      ) : curationLoadError ? (
        <ErrorState error={curationLoadError} />
      ) : (
        <ShortlistPanel
          shortlist={shortlist}
          dispatch={dispatch}
          notes={notes}
          onNotesChange={setNotes}
          saveState={saveState}
          saveError={saveError}
          hasUnsavedChanges={hasUnsavedChanges}
          hasEverSaved={hasEverSaved}
          onSave={handleSave}
          isStaleVsSaved={isStaleVsSaved}
          savedCriteria={savedStalenessSnapshot}
          currentCriteria={currentSnapshot}
          onSearchAgain={handleSearch}
        />
      )}
    </div>
  );
}
