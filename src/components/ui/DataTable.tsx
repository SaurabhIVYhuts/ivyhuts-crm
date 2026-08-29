"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  // A narrow column (e.g. a status pill) shouldn't stretch — most columns
  // omit this and share the remaining width evenly.
  width?: string;
  className?: string;
}

// The one table shell every list page (Leads, Follow-ups, Meetings, Team)
// renders through, so column padding, header style, hover/row-click
// behavior, loading skeletons, and empty states never drift between pages.
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  onRowClick,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  skeletonRows = 6,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading: boolean;
  onRowClick?: (row: T) => void;
  emptyIcon?: LucideIcon;
  emptyTitle: string;
  emptyDescription?: string;
  skeletonRows?: number;
}) {
  if (!isLoading && rows.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface">
        <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-max text-left text-sm">
        <thead>
          <tr className="border-b border-line">
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className="whitespace-nowrap px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-faint"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {isLoading
            ? Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <Skeleton className="h-4 w-full max-w-32" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? "cursor-pointer transition-colors hover:bg-surface-hover" : ""}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 align-middle text-ink ${col.className || ""}`}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
