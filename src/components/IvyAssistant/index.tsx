"use client";

// Ivy Assistant — popup AI agent for CRM sales staff (Phase 1, read-only).
//
// Mounted once in the authenticated app shell (src/app/dashboard/layout.tsx).
// Renders nothing for logged-out users. The transcript is held here (via
// useAssistantStream), mirrored to localStorage per user, and survives
// minimize / page refresh; "New chat" clears it.

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Launcher } from "./Launcher";
import { Panel } from "./Panel";
import { useAssistantStream } from "./useAssistantStream";

export function IvyAssistant() {
  const { sessionUser, isLoading } = useAuth();
  const [open, setOpen] = useState(false);

  // Hook is always called (rules of hooks); it's cheap and inert until a
  // message is sent. We simply don't render any UI for logged-out users.
  const assistant = useAssistantStream(sessionUser?.id ?? null);

  if (isLoading || !sessionUser) return null;

  return (
    <>
      <Launcher open={open} onClick={() => setOpen(true)} />
      {open && (
        <Panel assistant={assistant} onMinimize={() => setOpen(false)} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

export default IvyAssistant;
