"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";

const MAX_ROWS = 4;

export function Composer({
  streaming,
  disabled,
  onSend,
  onStop,
}: {
  streaming: boolean;
  disabled: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // auto-grow to ~MAX_ROWS lines
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 20 * MAX_ROWS + 16)}px`;
  }, [value]);

  const submit = () => {
    const t = value.trim();
    if (!t || streaming || disabled) return;
    onSend(t);
    setValue("");
    requestAnimationFrame(() => ref.current?.focus());
  };

  return (
    <div className="border-t border-line p-3">
      <div className="flex items-end gap-2 rounded-xl border border-line bg-surface px-2.5 py-2 focus-within:border-accent/50">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          disabled={disabled}
          placeholder={disabled ? "Assistant unavailable" : "Ask about leads, meetings, rooms…"}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          className="max-h-32 flex-1 resize-none bg-transparent text-sm text-ink outline-none placeholder:text-faint disabled:cursor-not-allowed"
        />
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink hover:bg-surface-hover"
          >
            <Square className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim() || disabled}
            aria-label="Send message"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition-colors hover:bg-accent-strong disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="mt-1 px-1 text-[10px] text-faint">Enter to send · Shift+Enter for a new line</p>
    </div>
  );
}
