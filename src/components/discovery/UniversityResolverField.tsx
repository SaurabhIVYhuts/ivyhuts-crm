"use client";

// University input + explicit resolution — Milestone 23.7 Part 14/15.
// Resolution is a deliberate, explicit action (a "Resolve" click), not
// triggered on every keystroke — same "explicit action, never automatic"
// philosophy already established for Find Rooms search/save. Editing the
// text after a resolution clears the stale resolved snapshot rather than
// leaving a mismatched one in place; the agent must re-resolve.
import { useState } from "react";
import { AlertTriangle, Check, MapPin } from "lucide-react";
import { resolveUniversity } from "@/lib/api/universities";
import type { DiscoveryUniversitySnapshot } from "@/types/discovery";
import type { ResolvedUniversity } from "@/types/university";

const inputClass =
  "w-full rounded-md border border-line bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent dark:border-line";
const labelClass = "text-xs font-medium text-subtle dark:text-faint";

function toSnapshot(u: ResolvedUniversity): DiscoveryUniversitySnapshot {
  return { id: u.id, name: u.name, city: u.city, country: u.country, latitude: u.latitude, longitude: u.longitude };
}

export function UniversityResolverField({
  value,
  onChange,
  resolved,
  onResolvedChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  resolved: DiscoveryUniversitySnapshot | null;
  onResolvedChange: (resolved: DiscoveryUniversitySnapshot | null) => void;
  disabled?: boolean;
}) {
  const [isResolving, setIsResolving] = useState(false);
  const [candidates, setCandidates] = useState<ResolvedUniversity[] | null>(null);
  const [status, setStatus] = useState<"idle" | "unresolved">("idle");

  async function handleResolve() {
    const query = value.trim();
    if (!query) return;
    setIsResolving(true);
    setCandidates(null);
    setStatus("idle");
    try {
      const result = await resolveUniversity(query);
      if (result.resolved) {
        onResolvedChange(toSnapshot(result.university));
        setStatus("idle");
      } else if ("candidates" in result) {
        setCandidates(result.candidates);
      } else {
        onResolvedChange(null);
        setStatus("unresolved");
      }
    } catch {
      onResolvedChange(null);
      setStatus("unresolved");
    } finally {
      setIsResolving(false);
    }
  }

  function pickCandidate(candidate: ResolvedUniversity) {
    onChange(candidate.name);
    onResolvedChange(toSnapshot(candidate));
    setCandidates(null);
    setStatus("idle");
  }

  return (
 <div className="flex flex-col gap-1">
 <label htmlFor="discovery-university" className={labelClass}>
        University
      </label>
 <div className="flex gap-1.5">
        <input
          id="discovery-university"
 className={inputClass}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.value);
            // Text changed since the last resolution — that resolved
            // snapshot no longer necessarily matches, so clear it rather
            // than silently keep a stale one.
            if (resolved) onResolvedChange(null);
            setCandidates(null);
            setStatus("idle");
          }}
        />
        <button
          type="button"
          onClick={handleResolve}
          disabled={disabled || isResolving || !value.trim()}
 className="shrink-0 rounded-md border border-line px-3 py-1.5 text-sm text-subtle hover:bg-surface-2 disabled:opacity-50 dark:border-line dark:text-subtle dark:hover:bg-surface-2"
        >
          {isResolving ? "Resolving…" : "Resolve"}
        </button>
      </div>

      {resolved && (
 <div className="flex items-center gap-1.5 text-xs text-success dark:text-success">
 <Check className="h-3.5 w-3.5 shrink-0" />
 <MapPin className="h-3.5 w-3.5 shrink-0" />
          {resolved.name}
 {(resolved.city || resolved.country) && <span className="text-subtle dark:text-faint">· {[resolved.city, resolved.country].filter(Boolean).join(", ")}</span>}
        </div>
      )}

      {candidates && candidates.length > 0 && (
 <div className="rounded-md border border-warning/30 bg-warning/10 p-2 text-xs dark:border-warning/30 dark:bg-warning/10">
 <p className="mb-1.5 flex items-center gap-1 font-medium text-warning dark:text-warning">
 <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            University could not be uniquely resolved. Choose one:
          </p>
 <div className="flex flex-col gap-1">
            {candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pickCandidate(c)}
 className="rounded border border-warning/30 bg-surface px-2 py-1 text-left text-warning hover:bg-warning/10 dark:border-warning/30 dark:bg-transparent dark:text-warning dark:hover:bg-warning/10"
              >
                {c.name}
 {(c.city || c.country) && <span className="text-warning dark:text-warning"> · {[c.city, c.country].filter(Boolean).join(", ")}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {status === "unresolved" && !candidates && (
 <p className="flex items-center gap-1 text-xs text-warning dark:text-warning">
 <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          University could not be resolved. Find Rooms cannot search distance-aware results yet, but the free-text name is still saved.
        </p>
      )}
    </div>
  );
}
