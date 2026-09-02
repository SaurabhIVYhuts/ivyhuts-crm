"use client";

import { Sparkles } from "lucide-react";

// Floating launcher — fixed bottom-right, above app chrome but below modals
// (Modal uses z-50; this sits at z-40). Hidden while the panel is open.
export function Launcher({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Open Ivy Assistant"
      onClick={onClick}
      className={`fixed bottom-6 right-6 z-40 flex items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-black/40 outline-none transition-all hover:scale-105 focus-visible:ring-2 focus-visible:ring-accent/50 motion-reduce:transition-none motion-reduce:hover:scale-100 ${
        open ? "pointer-events-none scale-90 opacity-0" : "scale-100 opacity-100"
      }`}
      style={{ height: 52, width: 52 }}
    >
      <Sparkles className="h-5 w-5" />
    </button>
  );
}
