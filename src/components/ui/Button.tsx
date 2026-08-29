import type { ButtonHTMLAttributes, ReactNode } from "react";

// The one button component every page should use, so "primary action" /
// "secondary action" / "destructive action" always look and behave
// identically everywhere in the CRM.
const VARIANTS = {
  primary: "bg-accent text-white hover:bg-accent-strong focus-visible:ring-accent/40",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-hover focus-visible:ring-line",
  ghost: "text-subtle hover:bg-surface-2 hover:text-ink focus-visible:ring-line",
  danger: "bg-danger/10 text-danger hover:bg-danger/20 focus-visible:ring-danger/40",
} as const;

const SIZES = {
  sm: "px-2.5 py-1.5 text-xs gap-1.5",
  md: "px-3.5 py-2 text-sm gap-2",
} as const;

export function Button({
  variant = "secondary",
  size = "md",
  icon: Icon,
  iconClassName = "",
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  icon?: React.ComponentType<{ className?: string }>;
  // Extra classes merged onto the icon only — e.g. "animate-spin" for a
  // button that reflects an in-progress async action (Refresh Leads while
  // syncing) without needing a whole separate spinner element.
  iconClassName?: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {Icon && <Icon className={`h-3.5 w-3.5 ${iconClassName}`} />}
      {children}
    </button>
  );
}
