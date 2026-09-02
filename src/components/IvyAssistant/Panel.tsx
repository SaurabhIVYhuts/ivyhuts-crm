"use client";

import { useEffect, useRef } from "react";
import { Minus, Plus, X } from "lucide-react";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";
import type { UseAssistantStream } from "./useAssistantStream";

export function Panel({
  assistant,
  onMinimize,
  onClose,
}: {
  assistant: UseAssistantStream;
  onMinimize: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Esc minimizes (keeps transcript). On mobile the panel is a full-screen
  // sheet and traps focus; on desktop it does not.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMinimize();
      if (e.key === "Tab" && window.matchMedia("(max-width: 639px)").matches) {
        const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
          'button, textarea, a[href], [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onMinimize]);

  const blocked = assistant.unavailable || assistant.unauthorized;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Ivy Assistant"
      className="fixed z-40 flex flex-col overflow-hidden border border-line bg-canvas shadow-2xl shadow-black/50
                 inset-0 rounded-none
                 sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(640px,80vh)] sm:w-[400px] sm:rounded-2xl
                 motion-safe:animate-[ivy-in_150ms_ease-out]"
      style={{ transformOrigin: "bottom right" }}
    >
      <style>{`@keyframes ivy-in { from { opacity: 0; transform: scale(0.96) } to { opacity: 1; transform: scale(1) } }`}</style>

      {/* header */}
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <span className="text-sm font-semibold text-ink">Ivy Assistant</span>
        <span className="rounded-full border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-faint">
          read-only
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={assistant.newChat}
            title="New chat"
            aria-label="New chat"
            className="flex h-7 w-7 items-center justify-center rounded-md text-faint hover:bg-surface hover:text-ink"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onMinimize}
            title="Minimize"
            aria-label="Minimize"
            className="flex h-7 w-7 items-center justify-center rounded-md text-faint hover:bg-surface hover:text-ink"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close Ivy Assistant"
            className="flex h-7 w-7 items-center justify-center rounded-md text-faint hover:bg-surface hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {assistant.unauthorized ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-subtle">
          Please sign in again.
        </div>
      ) : assistant.unavailable ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-subtle">
          Ivy Assistant is unavailable right now. The rest of the CRM is unaffected.
        </div>
      ) : (
        <MessageList
          messages={assistant.messages}
          awaitingFirstToken={assistant.awaitingFirstToken}
          streaming={assistant.streaming}
          onExample={assistant.send}
          onRetry={assistant.retryLast}
        />
      )}

      <Composer
        streaming={assistant.streaming}
        disabled={blocked}
        onSend={assistant.send}
        onStop={assistant.stop}
      />
    </div>
  );
}
