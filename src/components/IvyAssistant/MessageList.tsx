"use client";

import { useEffect, useRef } from "react";
import { Check, RefreshCw, AlertTriangle } from "lucide-react";
import { Markdown } from "./Markdown";
import { toolLabel } from "./toolLabels";
import type { ChatMessage, ToolActivity } from "./useAssistantStream";

const EXAMPLE_PROMPTS = [
  "Which of my leads have gone cold?",
  "Studios near UCL under £350/week",
  "Summarise my last meeting with [lead]",
  "What's the cost of living in Manchester?",
];

function ToolChip({ tool }: { tool: ToolActivity }) {
  const label = toolLabel(tool.name);
  if (tool.status === "running") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2 py-1 text-xs text-subtle">
        <span className="h-3 w-3 animate-spin rounded-full border border-subtle border-t-transparent motion-reduce:animate-none" />
        {label.active}…
      </span>
    );
  }
  if (tool.status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2 py-1 text-xs text-danger">
        <AlertTriangle className="h-3 w-3" />
        {label.active} failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2 py-1 text-xs text-faint">
      <Check className="h-3 w-3 text-success" />
      {label.done}
    </span>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-1" aria-label="Assistant is typing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-subtle motion-reduce:animate-none"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  );
}

export function MessageList({
  messages,
  awaitingFirstToken,
  streaming,
  onExample,
  onRetry,
}: {
  messages: ChatMessage[];
  awaitingFirstToken: boolean;
  streaming: boolean;
  onExample: (text: string) => void;
  onRetry: () => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  // Only auto-scroll if the user is already near the bottom.
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  useEffect(() => {
    if (stickRef.current) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, awaitingFirstToken]);

  const empty = messages.length === 0;

  return (
    <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 py-3">
      {empty && (
        <div className="flex h-full flex-col justify-center gap-4">
          <div className="text-sm text-subtle">
            <p className="font-medium text-ink">Hi — I&apos;m Ivy Assistant.</p>
            <p className="mt-1">
              Ask me about your leads, meetings, accommodation inventory or university knowledge. I can read CRM data
              but can&apos;t change anything.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {EXAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onExample(p)}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-left text-xs text-ink transition-colors hover:bg-surface-hover"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {messages.map((m) => {
          if (m.system) {
            return (
              <div
                key={m.id}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                  m.error ? "border-danger/30 bg-danger-soft text-ink" : "border-line bg-surface text-subtle"
                }`}
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
                <div className="flex-1">
                  <p>{m.content}</p>
                  {m.error && (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 font-medium text-ink hover:bg-surface-hover"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Retry
                    </button>
                  )}
                </div>
              </div>
            );
          }

          if (m.role === "user") {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-accent px-3 py-2 text-sm text-white">
                  {m.content}
                </div>
              </div>
            );
          }

          return (
            <div key={m.id} className="flex flex-col gap-1.5">
              {m.tools && m.tools.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {m.tools.map((t) => (
                    <ToolChip key={t.id} tool={t} />
                  ))}
                </div>
              )}
              <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-surface px-3 py-2 text-sm text-ink">
                {m.content ? <Markdown text={m.content} /> : awaitingFirstToken && streaming ? <TypingDots /> : null}
              </div>
            </div>
          );
        })}

        {/* typing indicator for a turn that has no assistant bubble yet */}
        {streaming && awaitingFirstToken && messages[messages.length - 1]?.role === "user" && (
          <div className="flex">
            <div className="rounded-2xl rounded-bl-sm bg-surface px-3 py-2">
              <TypingDots />
            </div>
          </div>
        )}
      </div>
      <div ref={endRef} />
    </div>
  );
}
