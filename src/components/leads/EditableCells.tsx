"use client";

// Inline-editable grid cells for the Lead Inbox (CRM plan item 2 —
// "editable like a spreadsheet"). Each cell owns only its own draft text
// and save state; the parent owns the row data and performs the optimistic
// update + revert. Text/number/date cells commit on blur or Enter (never
// per keystroke — that would be a request per character); selects commit
// immediately on change.
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

export type SaveFn = (raw: string) => Promise<void>;

type CellState = "idle" | "saving" | "error";

// Shared visual language: a borderless input that only reveals its frame
// on hover/focus, so a dense grid reads as data first and a form second.
// Deliberately sets NO width — each cell passes its own `widthClass`, and a
// `w-full` here would collide with it (Tailwind resolves conflicting width
// utilities by stylesheet order, not by the order they appear in the
// string, so the narrow budget inputs silently lost).
const BASE =
  "rounded-md border border-transparent bg-transparent text-ink outline-none " +
  "hover:border-line focus:border-accent focus:bg-surface disabled:opacity-60";

// Text size and vertical padding travel together. "dense" (13px) is for
// the Lead Inbox's fit-to-width grid, where a dozen editable columns share
// the page; "sm" is everything else.
export type CellSize = "sm" | "dense";
const SIZE: Record<CellSize, string> = {
  sm: "px-1.5 py-1 text-sm",
  dense: "px-1.5 py-1 text-[13px]",
};

// Number inputs reserve room for spinner arrows even while the arrows are
// hidden, which in a narrow grid cell left only a digit or two visible.
// Every number here is typed anyway, so the arrows go.
const NO_SPINNER =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

function stateClass(state: CellState): string {
  if (state === "saving") return "opacity-60";
  if (state === "error") return "border-danger bg-danger-soft";
  return "";
}

export function TextCell({
  value,
  onSave,
  placeholder,
  type = "text",
  title,
  widthClass = "min-w-32",
  size = "sm",
  multiline = false,
}: {
  value: string | null;
  onSave: SaveFn;
  placeholder?: string;
  type?: "text" | "date" | "number" | "email" | "tel";
  title?: string;
  widthClass?: string;
  size?: CellSize;
  // A wrapping two-line textarea instead of an input, for longer free text
  // (the Lead Inbox summary) in a narrow column. Enter still commits — the
  // text only wraps; it isn't meant to hold line breaks.
  multiline?: boolean;
}) {
  const committed = value ?? "";
  const [draft, setDraft] = useState(committed);
  const [state, setState] = useState<CellState>("idle");
  const [errorText, setErrorText] = useState<string | null>(null);
  // Track the last value the parent gave us so an external refresh (a
  // reload, another agent's edit) replaces the draft — but a draft the
  // user is actively typing is never clobbered mid-edit.
  const lastCommitted = useRef(committed);
  const focused = useRef(false);
  // Set by Escape so the blur it triggers doesn't save. The blur handler
  // runs synchronously, before React applies the reverted draft, so without
  // this it committed the very edit Escape was meant to throw away.
  const cancelling = useRef(false);

  useEffect(() => {
    if (committed !== lastCommitted.current) {
      lastCommitted.current = committed;
      if (!focused.current) setDraft(committed);
    }
  }, [committed]);

  async function commit() {
    if (draft === committed) return;
    setState("saving");
    setErrorText(null);
    try {
      await onSave(draft);
      lastCommitted.current = draft;
      setState("idle");
    } catch (err) {
      setState("error");
      setErrorText(err instanceof Error ? err.message : "Couldn't save.");
      setDraft(committed); // revert to the last known-good value
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
    if (e.key === "Escape") {
      cancelling.current = true;
      setDraft(committed);
      setState("idle");
      e.currentTarget.blur();
    }
  }

  function handleFocus() {
    focused.current = true;
  }

  function handleBlur() {
    focused.current = false;
    if (cancelling.current) {
      cancelling.current = false;
      return;
    }
    commit();
  }

  const className = `${BASE} ${SIZE[size]} ${widthClass} ${stateClass(state)}`;

  if (multiline) {
    return (
      <textarea
        rows={2}
        value={draft}
        placeholder={placeholder}
        title={errorText || title}
        disabled={state === "saving"}
        onFocus={handleFocus}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`${className} resize-none leading-snug`}
      />
    );
  }
  return (
    <input
      type={type}
      value={draft}
      placeholder={placeholder}
      title={errorText || title}
      disabled={state === "saving"}
      onFocus={handleFocus}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={type === "number" ? `${className} ${NO_SPINNER}` : className}
    />
  );
}

export function SelectCell<T extends string>({
  value,
  options,
  labelOf,
  onSave,
  widthClass = "min-w-28",
  size = "sm",
  title,
}: {
  value: T;
  options: readonly T[];
  labelOf: (option: T) => string;
  onSave: SaveFn;
  widthClass?: string;
  size?: CellSize;
  title?: string;
}) {
  const [state, setState] = useState<CellState>("idle");
  const [errorText, setErrorText] = useState<string | null>(null);

  async function commit(next: string) {
    if (next === value) return;
    setState("saving");
    setErrorText(null);
    try {
      await onSave(next);
      setState("idle");
    } catch (err) {
      setState("error");
      setErrorText(err instanceof Error ? err.message : "Couldn't save.");
    }
  }

  return (
    <select
      value={value}
      title={errorText || title}
      disabled={state === "saving"}
      onChange={(e) => commit(e.target.value)}
      className={`${BASE} ${SIZE[size]} ${widthClass} ${stateClass(state)}`}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {labelOf(option)}
        </option>
      ))}
    </select>
  );
}
