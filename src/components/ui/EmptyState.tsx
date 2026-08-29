import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

// Deliberately compact (~120-150px) — the previous version's oversized
// dashed rectangle is exactly the "unfinished product" smell this redesign
// removes. An empty state should read as a calm, expected state, not a
// placeholder waiting to be filled in.
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1.5 rounded-lg bg-surface-2/60 text-center ${compact ? "px-4 py-5" : "px-6 py-8"}`}
    >
      <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-surface text-faint">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="max-w-xs text-xs text-subtle">{description}</p>}
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  );
}
