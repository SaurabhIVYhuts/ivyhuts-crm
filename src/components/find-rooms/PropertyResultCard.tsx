"use client";

import { Check, ExternalLink, Plus } from "lucide-react";
import type { CanonicalProperty } from "@/lib/property-intelligence";
import { formatAvailability, formatCity, formatDistanceKm, formatRent, formatRoomType, formatSharing } from "@/lib/findRooms/format";
import { PROPERTY_SOURCE_LABELS } from "@/types/property";

export function PropertyResultCard({
  property,
  isShortlisted,
  onAddToShortlist,
}: {
  property: CanonicalProperty;
  isShortlisted: boolean;
  onAddToShortlist: (property: CanonicalProperty) => void;
}) {
  return (
 <div className="flex flex-col overflow-hidden rounded-lg border border-line dark:border-line">
      {property.image ? (
        // eslint-disable-next-line @next/next/no-img-element
 <img src={property.image} alt="" className="h-32 w-full object-cover" />
      ) : (
 <div className="flex h-32 w-full items-center justify-center bg-surface-2 text-xs text-faint dark:bg-surface-2">
          No image
        </div>
      )}

 <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
 <div className="truncate text-sm font-semibold text-ink dark:text-ink">{property.name}</div>
 <div className="flex items-center gap-1.5 text-xs text-subtle dark:text-faint">
 <span className="rounded bg-surface-2 px-1.5 py-0.5 font-medium uppercase tracking-wide text-subtle dark:bg-surface-2 dark:text-faint">
              {PROPERTY_SOURCE_LABELS[property.provider]}
            </span>
 <span className="truncate">{formatCity(property.city)}</span>
          </div>
        </div>

 <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
          <div>
 <dt className="text-subtle dark:text-faint">Rent</dt>
 <dd className="text-ink dark:text-ink">{formatRent(property.rent, property.currency, property.rentPeriod)}</dd>
          </div>
          <div>
 <dt className="text-subtle dark:text-faint">Sharing</dt>
 <dd className="text-ink dark:text-ink">{formatSharing(property.sharing)}</dd>
          </div>
          <div>
 <dt className="text-subtle dark:text-faint">Room type</dt>
 <dd className="text-ink dark:text-ink">{formatRoomType(property.roomType)}</dd>
          </div>
          <div>
 <dt className="text-subtle dark:text-faint">Availability</dt>
 <dd className="text-ink dark:text-ink">{formatAvailability(property.availability)}</dd>
          </div>
 <div className="col-span-2">
 <dt className="text-subtle dark:text-faint">Distance</dt>
            {/* Backend-provided distanceFromUniversityKm only — never
                recomputed here (Milestone 23.5 Part 11). */}
 <dd className="text-ink dark:text-ink">{formatDistanceKm(property.distanceFromUniversityKm)}</dd>
          </div>
        </dl>

        {property.amenities.length > 0 && (
 <div className="flex flex-wrap gap-1">
            {property.amenities.map((a) => (
              <span
                key={a}
 className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-subtle dark:bg-surface-2 dark:text-subtle"
              >
 <Check className="h-3 w-3" />
                {a}
              </span>
            ))}
          </div>
        )}

 <div className="mt-auto flex items-center gap-2 pt-1">
          {property.url ? (
            <a
              href={property.url}
              target="_blank"
              rel="noreferrer"
 className="flex flex-1 items-center justify-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-medium text-subtle hover:bg-surface-2 dark:border-line dark:text-subtle dark:hover:bg-surface-2"
            >
 <ExternalLink className="h-3.5 w-3.5" />
              View Property
            </a>
          ) : (
 <span className="flex-1 rounded-md border border-dashed border-line px-2 py-1.5 text-center text-xs text-faint dark:border-line">
              No URL provided
            </span>
          )}
          <button
            type="button"
            disabled={isShortlisted}
            onClick={() => onAddToShortlist(property)}
 className="flex flex-1 items-center justify-center gap-1 rounded-md bg-accent px-2 py-1.5 text-xs font-medium text-white hover:bg-accent-strong disabled:opacity-50 "
          >
 {isShortlisted ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {isShortlisted ? "Shortlisted" : "Add to Shortlist"}
          </button>
        </div>
      </div>
    </div>
  );
}
