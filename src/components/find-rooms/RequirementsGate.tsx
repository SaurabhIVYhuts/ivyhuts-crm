"use client";

import { Check, X } from "lucide-react";
import type { FindRoomsRequirements, RequirementField } from "@/lib/findRooms/requirements";
import { REQUIREMENT_LABELS } from "@/lib/findRooms/requirements";

const ORDER: RequirementField[] = ["university", "budget", "sharing"];

// Honest "cannot search yet" state — Milestone 23.5 Part 5. Never calls
// /api/properties/search until all three are present; this is the only
// thing rendered in that case, in place of the criteria panel/results.
export function RequirementsGate({ requirements }: { requirements: FindRoomsRequirements }) {
  return (
 <div className="rounded-lg border border-dashed border-line p-4 dark:border-line">
 <p className="text-sm font-medium text-subtle dark:text-subtle">Complete Discovery to find rooms</p>
 <ul className="mt-3 flex flex-col gap-1.5">
        {ORDER.map((field) => {
          const isMet = !requirements.missing.includes(field);
          return (
 <li key={field} className="flex items-center gap-2 text-sm">
              {isMet ? (
 <Check className="h-4 w-4 shrink-0 text-success dark:text-success" />
              ) : (
 <X className="h-4 w-4 shrink-0 text-danger" />
              )}
 <span className={isMet ? "text-subtle dark:text-subtle" : "text-subtle dark:text-faint"}>
                {REQUIREMENT_LABELS[field]}
              </span>
            </li>
          );
        })}
      </ul>
      <a
        href="#discovery"
 className="mt-4 inline-block rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-strong "
      >
        Complete Discovery
      </a>
    </div>
  );
}
