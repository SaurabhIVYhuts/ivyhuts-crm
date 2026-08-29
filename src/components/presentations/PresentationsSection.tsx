"use client";

// Generation is gated on the lead's saved AccommodationCuration (Milestone
// 23.6/23.8) — NEVER on Discovery+CompetitiveAnalysis (the earlier gate this
// component used). CompetitiveAnalysis's backend route was confirmed absent
// by direct repo inspection (Milestones 23.2/23.6); gating a real feature on
// a system that was never implemented was itself the bug this rewrite
// fixes. AccommodationCuration is the ONLY source of truth for what a
// presentation contains — never live Find Rooms search state, matching the
// backend route's own rule (api/leads/[id]/presentations/index.js).
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, FileText, Download, Sparkles, MessageCircle, CalendarClock } from "lucide-react";
import { getAccommodationCuration } from "@/lib/api/accommodationCuration";
import { getDiscovery } from "@/lib/api/discovery";
import { listPresentations, generatePresentation, downloadPresentation } from "@/lib/api/presentations";
import type { AccommodationCuration } from "@/types/accommodationCuration";
import type { Discovery } from "@/types/discovery";
import type { Presentation, PresentationProperty, PresentationStatus } from "@/types/presentation";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { describeApiError, type ApiErrorState } from "@/lib/utils/errors";
import { formatDateTime } from "@/lib/utils/format";

// Milestone 23.20 — honest staleness detection (Phase 4/Phase 2 Q4): a
// presentation's own immutable snapshot never changes (see the backend's
// Presentation.js header comment — this is deliberately NOT rebuilt here),
// but the CRM should tell the agent when the LIVE curation/Discovery have
// moved on since a given version was generated, exactly the same
// "detect and disclose, never auto-regenerate" pattern
// src/lib/findRooms/staleness.ts already established for Find Rooms.
// `generatedFrom.discoveryUpdatedAt` is null on a presentation generated
// before this lead had any Discovery yet — Discovery existing now (even
// unconfirmed edits) counts as "new information became available since",
// so that also reads as stale rather than silently ignored.
export function isPresentationStale(
  latest: Pick<Presentation, "generatedFrom">,
  curation: Pick<AccommodationCuration, "updatedAt"> | null,
  discovery: Pick<Discovery, "updatedAt"> | null
): boolean {
  if (curation && new Date(curation.updatedAt).getTime() > new Date(latest.generatedFrom.accommodationCurationUpdatedAt ?? 0).getTime()) {
    return true;
  }
  if (discovery) {
    if (!latest.generatedFrom.discoveryUpdatedAt) return true;
    if (new Date(discovery.updatedAt).getTime() > new Date(latest.generatedFrom.discoveryUpdatedAt).getTime()) return true;
  }
  return false;
}

// Milestone 23.21 — a one-line summary of a property AS STORED in a
// version's own immutable snapshot (never re-formatted from a live
// curation lookup). Mirrors the backend's own honest-missing-data
// convention (see pptNormalizeAccommodation.js) — a genuinely absent
// room type/price is simply omitted from the line, never shown as a
// fabricated placeholder.
export function formatPresentationPropertySummary(p: PresentationProperty): string {
  const price = p.rent != null && p.currency ? `${p.currency} ${p.rent}${p.rentPeriod !== "unknown" ? `/${p.rentPeriod}` : ""}` : null;
  return [p.name, p.roomType, price].filter(Boolean).join(" — ");
}

function PropertyList({ properties }: { properties: PresentationProperty[] }) {
  if (properties.length === 0) {
 return <p className="mt-1.5 text-xs text-subtle dark:text-faint">No properties were included in this version.</p>;
  }
  return (
 <ul className="mt-1.5 flex flex-col gap-0.5">
      {properties.map((p) => (
 <li key={p.propertyId} className="text-xs text-subtle dark:text-faint">
          • {formatPresentationPropertySummary(p)}
        </li>
      ))}
    </ul>
  );
}

const STATUS_STYLES: Record<PresentationStatus, string> = {
  READY: "bg-success/10 text-success dark:bg-success/10 dark:text-success",
  GENERATING: "bg-warning/10 text-warning dark:bg-warning/10 dark:text-warning",
  FAILED: "bg-danger/10 text-danger dark:bg-danger/10 dark:text-danger",
};

const STATUS_LABELS: Record<PresentationStatus, string> = {
  READY: "Ready",
  GENERATING: "Generating",
  FAILED: "Failed",
};

function StatusPill({ status }: { status: PresentationStatus }) {
  return (
 <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PresentationsSection({ leadId }: { leadId: string }) {
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [curation, setCuration] = useState<AccommodationCuration | null>(null);
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [canGenerate, setCanGenerate] = useState(false);
  const [gateReason, setGateReason] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiErrorState | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [actionError, setActionError] = useState<ApiErrorState | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // Milestone 23.20 — Discovery fetched read-only, same "each section
      // owns its own data" convention every other Lead Detail section
      // already follows (see DiscoverySection/FindRoomsSection). Used only
      // for the staleness comparison below — never written to, and never
      // sent to the generate/download calls, which stay exactly as before.
      const [curationRes, discoveryRes, presentationsRes] = await Promise.all([
        getAccommodationCuration(leadId),
        getDiscovery(leadId),
        listPresentations(leadId),
      ]);
      const loadedCuration = curationRes.data;
      const ready = loadedCuration !== null && loadedCuration.properties.length > 0;
      setCuration(loadedCuration);
      setDiscovery(discoveryRes.data);
      setCanGenerate(ready);
      setGateReason(
        ready ? null : "Save your curated accommodation options before generating the presentation."
      );
      setPresentations(presentationsRes.data);
      setLoadError(null);
    } catch (err) {
      setLoadError(describeApiError(err));
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    // react-hooks/set-state-in-effect flags this because load() eventually
    // calls setState, even though every call is after an `await` (never
    // synchronous within this effect body) — same false positive/fix as
    // src/hooks/useAuth.ts's own refresh() call.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleGenerate() {
    setIsGenerating(true);
    setActionError(null);
    try {
      await generatePresentation(leadId);
      await load();
    } catch (err) {
      setActionError(describeApiError(err));
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleDownload(presentation: Presentation) {
    setDownloadingId(presentation.id);
    setActionError(null);
    try {
      await downloadPresentation(leadId, presentation.id, presentation.file.filename || `${presentation.title}.pptx`);
    } catch (err) {
      setActionError(describeApiError(err));
    } finally {
      setDownloadingId(null);
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

  const [latest, ...previous] = presentations;
  const stale = latest && latest.status === "READY" ? isPresentationStale(latest, curation, discovery) : false;

  return (
 <div className="flex flex-col gap-4">
 {gateReason && <p className="text-sm text-subtle dark:text-faint">{gateReason}</p>}

      {actionError && <ErrorState error={actionError} />}

      <div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate || isGenerating}
 className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50 "
        >
 <Sparkles className="h-3.5 w-3.5" />
          {isGenerating
            ? "Generating…"
            : presentations.length > 0
              ? "Generate New Version"
              : "Generate Presentation"}
        </button>
      </div>

      {presentations.length === 0 ? (
        <EmptyState icon={FileText} title="No presentations generated yet." />
      ) : (
        <>
 <div className="rounded-lg border border-line p-4 dark:border-line">
 <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle dark:text-faint">
              Latest Presentation
            </div>
 <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
 <div className="font-medium text-ink dark:text-ink">{latest.title}</div>
 <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-subtle dark:text-faint">
                  <StatusPill status={latest.status} />
 <span className="font-medium text-subtle dark:text-subtle">Latest</span>
                  <span>Version {latest.version}</span>
                  <span>Created {formatDateTime(latest.createdAt)}</span>
                  {latest.status === "READY" && (
                    <span>{latest.properties.length} propert{latest.properties.length === 1 ? "y" : "ies"}</span>
                  )}
                </div>
                {/* Milestone 23.21 Phase 2 — exactly what this version's own
                    immutable snapshot contains, never a live curation
                    lookup (see PresentationProperty's own type comment). */}
                {latest.status === "READY" && <PropertyList properties={latest.properties} />}
                {/* Phase 9 — the current shortlist is a SEPARATE, live
                    concept from this generated version's historical
                    snapshot; only surfaced when it actually differs, and
                    worded so it never implies a newer property was part of
                    this already-generated version. */}
                {latest.status === "READY" && curation && curation.properties.length !== latest.properties.length && (
 <p className="mt-1.5 text-xs italic text-subtle dark:text-faint">
                    Current shortlist has {curation.properties.length} propert{curation.properties.length === 1 ? "y" : "ies"} — not reflected in this already-generated version.
                  </p>
                )}
              </div>
              {latest.status === "READY" && (
                <button
                  type="button"
                  onClick={() => handleDownload(latest)}
                  disabled={downloadingId === latest.id}
 className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-subtle hover:bg-surface-2 disabled:opacity-50 dark:border-line dark:text-subtle dark:hover:bg-surface-2"
                >
 <Download className="h-3.5 w-3.5" />
                  {downloadingId === latest.id ? "Downloading…" : "Download"}
                </button>
              )}
            </div>
            {latest.status === "FAILED" && latest.errorMessage && (
 <p className="mt-2 text-xs text-danger dark:text-danger">{latest.errorMessage}</p>
            )}

            {/* Milestone 23.20 — the presentation FILE itself never changes
                (immutable snapshot, unchanged) — this only discloses that
                the LIVE curation/Discovery have moved on since generation,
                same "detect and disclose, never auto-regenerate" rule as
                Find Rooms' own staleness banner. Generating a new version
                remains a fully separate, explicit agent action (the button
                above) — this never triggers it automatically. */}
            {latest.status === "READY" && stale && (
 <div className="mt-3 flex items-center gap-2 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning dark:bg-warning/10 dark:text-warning">
 <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Requirements or the curated shortlist changed since this version was generated — consider generating a new version before sharing it.
              </div>
            )}

            {/* Milestone 23.12 Part 8 — a generated PPT is NOT the same as
                a delivered one; this never marks the presentation "shared"
                (no such status exists, and none is invented here). It's
                purely a prompt toward the next real action, backed by the
                real Communication/FollowUp sections lower on this page. */}
            {latest.status === "READY" && !stale && (
 <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-success/10 px-3 py-2 dark:bg-success/10">
 <p className="text-xs text-success dark:text-success">
                  Presentation ready — follow up with the student.
                </p>
 <div className="flex gap-2">
                  <a
                    href="#communications"
 className="flex items-center gap-1 rounded-md border border-success/30 px-2.5 py-1 text-xs font-medium text-success hover:bg-success/10 dark:border-success/30 dark:text-success dark:hover:bg-success/10"
                  >
 <MessageCircle className="h-3 w-3" />
                    Record Communication
                  </a>
                  <a
                    href="#follow-ups"
 className="flex items-center gap-1 rounded-md border border-success/30 px-2.5 py-1 text-xs font-medium text-success hover:bg-success/10 dark:border-success/30 dark:text-success dark:hover:bg-success/10"
                  >
 <CalendarClock className="h-3 w-3" />
                    Create Follow-up
                  </a>
                </div>
              </div>
            )}
          </div>

          {previous.length > 0 && (
            <div>
 <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle dark:text-faint">
                Previous Presentations
              </div>
 <ul className="flex flex-col gap-2">
                {previous.map((p) => {
                  // Phase 7/8 — the SAME canonical isPresentationStale used
                  // for the latest version above, just evaluated against
                  // this older version's own generatedFrom — never a
                  // second freshness algorithm. Staleness is a disclosure
                  // about the LIVE curation/Discovery moving on; it never
                  // rewrites this version's own historical property list
                  // (rendered below from p.properties, exactly as stored).
                  const versionStale = p.status === "READY" && isPresentationStale(p, curation, discovery);
                  return (
 <li key={p.id} className="rounded-md border border-line-soft px-3 py-2 text-sm dark:border-line">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <div className="flex flex-wrap items-center gap-2">
 <span className="font-medium text-ink dark:text-ink">Version {p.version}</span>
                          <StatusPill status={p.status} />
 <span className="text-xs text-subtle dark:text-faint">Older</span>
 <span className="text-xs text-subtle dark:text-faint">{formatDateTime(p.createdAt)}</span>
                          {p.status === "READY" && (
 <span className="text-xs text-subtle dark:text-faint">
                              {p.properties.length} propert{p.properties.length === 1 ? "y" : "ies"}
                            </span>
                          )}
                          {versionStale && (
 <span className="flex items-center gap-1 text-xs text-warning dark:text-warning">
 <AlertTriangle className="h-3 w-3" />
                              Requirements changed since generation
                            </span>
                          )}
                        </div>
                        {p.status === "READY" && (
                          <button
                            type="button"
                            onClick={() => handleDownload(p)}
                            disabled={downloadingId === p.id}
 className="flex items-center gap-1 text-xs text-subtle hover:underline dark:text-faint"
                          >
 <Download className="h-3 w-3" />
                            {downloadingId === p.id ? "Downloading…" : "Download"}
                          </button>
                        )}
                      </div>
                      {p.status === "READY" && <PropertyList properties={p.properties} />}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
