// A small, deterministic "colored initials" avatar — no photo storage exists
// anywhere in this backend, so this is the honest representation of a
// person: real initials from their real name, a stable (not random) accent
// derived from the name itself so the same person always gets the same
// color across the app.
const PALETTE = [
  "bg-blue-500/15 text-blue-300",
  "bg-violet-500/15 text-violet-300",
  "bg-emerald-500/15 text-emerald-300",
  "bg-amber-500/15 text-amber-300",
  "bg-rose-500/15 text-rose-300",
  "bg-cyan-500/15 text-cyan-300",
  "bg-fuchsia-500/15 text-fuchsia-300",
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function initialsFrom(name: string | null | undefined): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SIZE_CLASSES = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
} as const;

export function Avatar({
  name,
  size = "md",
  className = "",
}: {
  name: string | null | undefined;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  const label = name || "Unassigned";
  const palette = PALETTE[hashString(label) % PALETTE.length];
  return (
    <span
      title={name || undefined}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${SIZE_CLASSES[size]} ${palette} ${className}`}
    >
      {initialsFrom(name)}
    </span>
  );
}
