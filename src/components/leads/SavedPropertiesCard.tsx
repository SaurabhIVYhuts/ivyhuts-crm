"use client";

// CRM plan item 7 — a lightweight "save a property to this lead by pasting
// its link" surface, independent of Find Rooms (which is gated behind
// completed Discovery). Reads and writes the SAME AccommodationCuration
// document; on Save it re-fetches first and merges, so an agent curating
// in Find Rooms on the same page isn't clobbered.
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Link2, Trash2 } from "lucide-react";
import { getAccommodationCuration, saveAccommodationCuration } from "@/lib/api/accommodationCuration";
import { buildCuratedPropertyFromUrl } from "@/lib/findRooms/addByUrl";
import { PROPERTY_SOURCE_LABELS } from "@/types/property";
import type { AccommodationCuration, CuratedProperty } from "@/types/accommodationCuration";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { describeApiError, type ApiErrorState } from "@/lib/utils/errors";

export function SavedPropertiesCard({ leadId }: { leadId: string }) {
  const [serverProps, setServerProps] = useState<CuratedProperty[]>([]);
  const [added, setAdded] = useState<CuratedProperty[]>([]);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiErrorState | null>(null);

  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<ApiErrorState | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getAccommodationCuration(leadId);
      setServerProps(res.data?.properties ?? []);
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

  const visible = [...serverProps.filter((p) => !removedIds.has(p.propertyId)), ...added];
  const dirty = added.length > 0 || removedIds.size > 0;

  function handleAdd() {
    setAddError(null);
    const result = buildCuratedPropertyFromUrl(url, name);
    if (!result.ok) {
      setAddError(result.error);
      return;
    }
    if (visible.some((p) => p.propertyId === result.property.propertyId)) {
      setAddError("That property is already on this lead.");
      return;
    }
    setAdded((prev) => [...prev, result.property]);
    setUrl("");
    setName("");
  }

  function handleRemove(propertyId: string) {
    if (added.some((p) => p.propertyId === propertyId)) {
      setAdded((prev) => prev.filter((p) => p.propertyId !== propertyId));
    } else {
      setRemovedIds((prev) => new Set(prev).add(propertyId));
    }
  }

  async function handleSave() {
    setSaveState("saving");
    setSaveError(null);
    try {
      // Re-fetch so a concurrent Find Rooms save on the same page isn't
      // overwritten — keep its criteria / recommendation / notes intact,
      // only reconcile the property list.
      const fresh = await getAccommodationCuration(leadId);
      const base: AccommodationCuration | null = fresh.data;
      const merged: CuratedProperty[] = [
        ...(base?.properties ?? []).filter((p) => !removedIds.has(p.propertyId)),
        ...added.filter((a) => !(base?.properties ?? []).some((p) => p.propertyId === a.propertyId)),
      ];
      await saveAccommodationCuration(leadId, {
        criteriaSnapshot: base?.criteriaSnapshot ?? null,
        properties: merged,
        recommendedPropertyId: base?.recommendedPropertyId ?? null,
        recommendationReason: base?.recommendationReason ?? null,
        notes: base?.notes ?? null,
      });
      setServerProps(merged);
      setAdded([]);
      setRemovedIds(new Set());
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (err) {
      setSaveState("error");
      setSaveError(describeApiError(err));
    }
  }

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (loadError) return <ErrorState error={loadError} onRetry={load} />;

  return (
    <div className="flex flex-col gap-3">
      {visible.length === 0 ? (
        <p className="text-xs text-faint">No properties saved yet. Paste a listing link below.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {visible.map((p) => (
            <li key={p.propertyId} className="flex items-start justify-between gap-2 rounded-lg border border-line px-2.5 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-ink">{p.name}</div>
                <div className="flex items-center gap-1.5 text-xs text-faint">
                  <span>{PROPERTY_SOURCE_LABELS[p.provider]}</span>
                  {p.url && (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-accent hover:underline"
                    >
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(p.propertyId)}
                aria-label={`Remove ${p.name}`}
                className="shrink-0 rounded-md p-1 text-faint hover:bg-surface-2 hover:text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-1.5 border-t border-line pt-3">
        <label className="flex items-center gap-1.5 text-xs font-medium text-subtle">
          <Link2 className="h-3.5 w-3.5" /> Add by link
        </label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (optional — derived from the link if blank)"
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent"
        />
        {addError && <p className="text-xs text-danger">{addError}</p>}
        <button
          type="button"
          onClick={handleAdd}
          className="self-start rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-subtle hover:bg-surface-2 hover:text-ink"
        >
          Add to lead
        </button>
      </div>

      {dirty && (
        <button
          type="button"
          onClick={handleSave}
          disabled={saveState === "saving"}
          className="self-start rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50"
        >
          {saveState === "saving" ? "Saving…" : "Save changes"}
        </button>
      )}
      {saveState === "saved" && (
        <span className="flex items-center gap-1 text-xs text-success">
          <CheckCircle2 className="h-3.5 w-3.5" /> Saved
        </span>
      )}
      {saveState === "error" && saveError && <ErrorState error={saveError} onRetry={handleSave} />}
    </div>
  );
}
