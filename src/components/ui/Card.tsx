import type { ReactNode } from "react";

// The one card shell every panel in the CRM should use — a subtle-contrast
// surface with a hairline border, never a heavy border or a pure-black box.
// `elevated` steps up one surface level (src/app/globals.css's --surface-2)
// for a card that sits visually "above" its surroundings (e.g. a modal or a
// card nested inside another card's padding).
export function Card({
  children,
  className = "",
  elevated = false,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-line ${elevated ? "bg-surface-2" : "bg-surface"} ${padded ? "p-4 sm:p-5" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  icon: Icon,
  action,
  className = "",
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-4 flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          {Icon && <Icon className="h-4 w-4 text-faint" />}
          {title}
        </h2>
        {description && <p className="mt-0.5 text-xs text-subtle">{description}</p>}
      </div>
      {action}
    </div>
  );
}
