"use client";

// Transport + transcript state for Ivy Assistant.
//
// EventSource can't POST, so the SSE stream is consumed with fetch +
// ReadableStream. The transcript lives in React state, is mirrored to
// localStorage (per user), capped to the last 30 messages, and resent in
// full on every turn (the backend is stateless — see
// api/_lib/routes/crm-tools/assistant.js).

import { useCallback, useEffect, useRef, useState } from "react";

export type ChatRole = "user" | "assistant";

export interface ToolActivity {
  id: string;
  name: string;
  status: "running" | "done" | "error";
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  /** rendered as markdown for assistant turns, plain text for user turns */
  content: string;
  /** assistant turns only: inline tool-activity chips */
  tools?: ToolActivity[];
  /** a non-blocking inline system/error notice rather than a real turn */
  system?: boolean;
  error?: boolean;
}

const STORAGE_PREFIX = "ivy_assistant_history_v1";
const MAX_STORED = 30;

type WireMessage = { role: ChatRole; content: string };

interface WireEvent {
  type: "text" | "tool_call" | "tool_result" | "done" | "error";
  delta?: string;
  id?: string;
  name?: string;
  args?: unknown;
  ok?: boolean;
  summary?: string;
  message?: string;
}

function apiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
  return raw;
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function storageKey(userId: string | null): string {
  return userId ? `${STORAGE_PREFIX}:${userId}` : STORAGE_PREFIX;
}

function loadHistory(userId: string | null): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    if (!Array.isArray(parsed)) return [];
    // Any tool chip persisted mid-stream is stale on reload.
    return parsed.slice(-MAX_STORED).map((m) => ({
      ...m,
      tools: m.tools?.map((t) => (t.status === "running" ? { ...t, status: "done" as const } : t)),
    }));
  } catch {
    return [];
  }
}

function saveHistory(userId: string | null, messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(messages.slice(-MAX_STORED)));
  } catch {
    /* quota / private mode — non-fatal */
  }
}

function toWire(messages: ChatMessage[]): WireMessage[] {
  return messages
    .filter((m) => !m.system && !m.error && m.content.trim() !== "")
    .slice(-MAX_STORED)
    .map((m) => ({ role: m.role, content: m.content }));
}

export interface UseAssistantStream {
  messages: ChatMessage[];
  streaming: boolean;
  /** first token not yet received for the in-flight assistant turn */
  awaitingFirstToken: boolean;
  unavailable: boolean;
  unauthorized: boolean;
  send: (text: string) => void;
  stop: () => void;
  retryLast: () => void;
  newChat: () => void;
}

export function useAssistantStream(userId: string | null): UseAssistantStream {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [awaitingFirstToken, setAwaitingFirstToken] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const hydratedRef = useRef(false);

  // Hydrate from storage once we know the user. Reading localStorage is an
  // external-system read that belongs in an effect; the repo's own
  // useAuth.ts disables this same rule for the equivalent case.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages(loadHistory(userId));
    hydratedRef.current = true;
  }, [userId]);

  // Persist on every change (after hydration).
  useEffect(() => {
    if (!hydratedRef.current) return;
    saveHistory(userId, messages);
  }, [userId, messages]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const patchLast = useCallback((fn: (m: ChatMessage) => ChatMessage) => {
    setMessages((prev) => {
      if (!prev.length) return prev;
      const copy = prev.slice();
      copy[copy.length - 1] = fn(copy[copy.length - 1]);
      return copy;
    });
  }, []);

  const runTurn = useCallback(
    async (history: ChatMessage[]) => {
      setUnavailable(false);
      setUnauthorized(false);
      setStreaming(true);
      setAwaitingFirstToken(true);

      const assistantId = newId();
      setMessages([...history, { id: assistantId, role: "assistant", content: "", tools: [] }]);

      const controller = new AbortController();
      abortRef.current = controller;

      const handleEvent = (evt: WireEvent, id: string) => {
        switch (evt.type) {
          case "text":
            if (evt.delta) {
              setAwaitingFirstToken(false);
              setMessages((prev) => {
                const copy = prev.slice();
                const idx = copy.findIndex((m) => m.id === id);
                if (idx === -1) return prev;
                copy[idx] = { ...copy[idx], content: copy[idx].content + evt.delta };
                return copy;
              });
            }
            break;
          case "tool_call":
            setMessages((prev) => {
              const copy = prev.slice();
              const idx = copy.findIndex((m) => m.id === id);
              if (idx === -1) return prev;
              const tools = (copy[idx].tools ?? []).slice();
              tools.push({ id: evt.id ?? newId(), name: evt.name ?? "tool", status: "running" });
              copy[idx] = { ...copy[idx], tools };
              return copy;
            });
            break;
          case "tool_result":
            setMessages((prev) => {
              const copy = prev.slice();
              const idx = copy.findIndex((m) => m.id === id);
              if (idx === -1) return prev;
              const tools = (copy[idx].tools ?? []).map((t) =>
                t.id === evt.id ? { ...t, status: evt.ok === false ? ("error" as const) : ("done" as const) } : t
              );
              copy[idx] = { ...copy[idx], tools };
              return copy;
            });
            break;
          case "error":
            setMessages((prev) => [
              ...prev,
              {
                id: newId(),
                role: "assistant",
                content: evt.message ?? "The assistant hit an error.",
                system: true,
                error: true,
              },
            ]);
            break;
          default:
            break;
        }
      };

      try {
        const res = await fetch(`${apiBase()}/api/assistant`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ messages: toWire(history) }),
          signal: controller.signal,
        });

        if (res.status === 401) {
          setUnauthorized(true);
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          return;
        }
        if (res.status === 503) {
          setUnavailable(true);
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          return;
        }
        if (res.status === 429) {
          let msg = "You're sending messages too quickly. Wait a moment.";
          try {
            const j = await res.json();
            if (j?.error) msg = j.error;
          } catch {
            /* keep default */
          }
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== assistantId),
            { id: newId(), role: "assistant", content: msg, system: true, error: true },
          ]);
          return;
        }
        if (!res.ok || !res.body) {
          let msg = "The assistant couldn't be reached. Please try again.";
          try {
            const j = await res.json();
            if (j?.error) msg = j.error;
          } catch {
            /* keep default */
          }
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== assistantId),
            { id: newId(), role: "assistant", content: msg, system: true, error: true },
          ]);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let streamDone = false;

        // Standard SSE framing: events separated by a blank line, payload on
        // `data:` lines.
        while (!streamDone) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            const dataLine = frame
              .split("\n")
              .filter((l) => l.startsWith("data:"))
              .map((l) => l.slice(5).trim())
              .join("");
            if (!dataLine) continue;

            let evt: WireEvent;
            try {
              evt = JSON.parse(dataLine) as WireEvent;
            } catch {
              continue;
            }
            handleEvent(evt, assistantId);
            if (evt.type === "done") streamDone = true;
          }
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") {
          patchLast((m) =>
            m.role === "assistant" && m.content === ""
              ? { ...m, content: "_(stopped)_", tools: m.tools?.map((t) => (t.status === "running" ? { ...t, status: "done" } : t)) }
              : m
          );
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: newId(),
              role: "assistant",
              content: "Something went wrong while streaming the reply.",
              system: true,
              error: true,
            },
          ]);
        }
      } finally {
        setStreaming(false);
        setAwaitingFirstToken(false);
        abortRef.current = null;
        // Drop an assistant turn that never produced anything.
        setMessages((prev) =>
          prev.filter((m) => !(m.role === "assistant" && m.content === "" && (!m.tools || m.tools.length === 0)))
        );
      }
    },
    [patchLast]
  );

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;
      const userMsg: ChatMessage = { id: newId(), role: "user", content: trimmed };
      const history = [...messages.filter((m) => !m.system && !m.error), userMsg].slice(-MAX_STORED);
      setMessages(history);
      void runTurn(history);
    },
    [messages, streaming, runTurn]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const retryLast = useCallback(() => {
    if (streaming) return;
    const lastUser = [...messages].reverse().find((m) => m.role === "user" && !m.system);
    if (!lastUser) return;
    // Drop everything after that user turn (stale assistant reply / error).
    const idx = messages.findIndex((m) => m.id === lastUser.id);
    const history = messages.slice(0, idx + 1).filter((m) => !m.system && !m.error);
    setMessages(history);
    void runTurn(history);
  }, [messages, streaming, runTurn]);

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setUnavailable(false);
    setUnauthorized(false);
    saveHistory(userId, []);
  }, [userId]);

  return {
    messages,
    streaming,
    awaitingFirstToken,
    unavailable,
    unauthorized,
    send,
    stop,
    retryLast,
    newChat,
  };
}
