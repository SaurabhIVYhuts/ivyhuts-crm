"use client";

import { AlertTriangle, CheckCircle2, MinusCircle, XCircle } from "lucide-react";
import { PROPERTY_SOURCE_LABELS, type ProviderCoverageEntry } from "@/types/property";

// One icon/label per provider status. NOT_CONFIGURED and UNAVAILABLE are
// visually distinct from SEARCHED/NO_RESULTS — an infrastructure
// limitation must never look like "zero results" (Milestone 23.5 Part 9).
function statusPresentation(entry: ProviderCoverageEntry): { icon: typeof CheckCircle2; className: string; label: string } {
  switch (entry.status) {
    case "SEARCHED":
      return { icon: CheckCircle2, className: "text-success dark:text-success", label: `${entry.count} ${entry.count === 1 ? "property" : "properties"}` };
    case "NO_RESULTS":
      return { icon: CheckCircle2, className: "text-success dark:text-success", label: "0 properties" };
    case "UNAVAILABLE":
      return { icon: AlertTriangle, className: "text-warning dark:text-warning", label: entry.reason || "Unavailable" };
    case "ERROR":
      return { icon: XCircle, className: "text-danger dark:text-danger", label: entry.reason || "Error" };
    case "NOT_CONFIGURED":
    default:
      return { icon: MinusCircle, className: "text-faint dark:text-subtle", label: "Not configured" };
  }
}

export function ProviderCoverage({ providerCoverage }: { providerCoverage: ProviderCoverageEntry[] }) {
  return (
    <div>
 <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle dark:text-faint">
        Sources checked
      </h3>
 <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {providerCoverage.map((entry) => {
          const { icon: Icon, className, label } = statusPresentation(entry);
          return (
            <li
              key={entry.provider}
 className="flex items-start gap-2 rounded-md border border-line p-2 text-sm dark:border-line"
            >
 <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${className}`} />
 <div className="min-w-0">
 <div className="font-medium text-ink dark:text-ink">{PROPERTY_SOURCE_LABELS[entry.provider]}</div>
 <div className="truncate text-xs text-subtle dark:text-faint" title={label}>
                  {label}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
