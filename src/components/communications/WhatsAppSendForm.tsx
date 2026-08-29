"use client";

import { useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { sendWhatsAppMessage } from "@/lib/api/whatsapp";
import { ApiRequestError } from "@/lib/api/client";
import { ErrorState } from "@/components/ui/ErrorState";
import { describeApiError, type ApiErrorState } from "@/lib/utils/errors";

const MAX_MESSAGE_LENGTH = 2000; // matches the backend's Communication.content cap

interface Template {
  label: string;
  build: (firstName: string | null) => string;
}

// CRM Milestone 13 spec §24-25 — a few static, non-automated suggestions
// that populate the editable message box. The agent must still review/edit
// and explicitly send; nothing here is sent automatically. Never hardcodes
// a name the lead doesn't have (spec §25) — falls back to a plain "Hi,".
const TEMPLATES: Template[] = [
  {
    label: "General introduction",
    build: (name) => `${name ? `Hi ${name},` : "Hi,"} this is your IVYHUTS accommodation advisor. I'm here to help you find the right place to stay for your studies. Let me know if you have any questions!`,
  },
  {
    label: "Presentation ready",
    build: (name) => `${name ? `Hi ${name},` : "Hi,"} I've prepared a personalized accommodation comparison based on what we discussed. I'll walk you through the options on our call.`,
  },
  {
    label: "Follow-up",
    build: (name) => `${name ? `Hi ${name},` : "Hi,"} just following up on our last conversation. Have you had a chance to think about the options we discussed?`,
  },
  {
    label: "Call reminder",
    build: (name) => `${name ? `Hi ${name},` : "Hi,"} just a reminder about our scheduled call. Looking forward to speaking with you!`,
  },
];

function firstNameOf(name: string | null): string | null {
  if (!name) return null;
  return name.trim().split(/\s+/)[0] || null;
}

export function WhatsAppSendForm({
  leadId,
  phone,
  leadName,
  onSent,
}: {
  leadId: string;
  phone: string | null;
  leadName: string | null;
  onSent: () => void;
}) {
  const [message, setMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<ApiErrorState | null>(null);
  // Once the backend confirms WhatsApp isn't configured (503), the form is
  // permanently disabled for the rest of this page view rather than
  // pretending Send might work on a retry (spec §27) — never shows which
  // specific secret is missing.
  const [configUnavailable, setConfigUnavailable] = useState(false);
  // A fresh id per confirmation-dialog open (i.e. per distinct "Send"
  // click) — reused unchanged only if that SAME click is retried after a
  // failure, so a genuine second click always gets a new key. See
  // src/lib/api/whatsapp.ts.
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  const trimmed = message.trim();
  const canOpenConfirm = !configUnavailable && Boolean(phone) && trimmed.length > 0 && trimmed.length <= MAX_MESSAGE_LENGTH;

  function openConfirm() {
    if (!canOpenConfirm) return;
    setIdempotencyKey(crypto.randomUUID());
    setSendError(null);
    setConfirmOpen(true);
  }

  async function handleConfirmSend() {
    if (!idempotencyKey) return;
    setIsSending(true);
    setSendError(null);
    try {
      await sendWhatsAppMessage(leadId, { message: trimmed }, idempotencyKey);
      setConfirmOpen(false);
      setMessage("");
      setIdempotencyKey(null);
      onSent();
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 503) {
        setConfigUnavailable(true);
        setConfirmOpen(false);
      } else {
        setSendError(describeApiError(err));
      }
    } finally {
      setIsSending(false);
    }
  }

  if (configUnavailable) {
    return (
 <div className="flex flex-col gap-2 rounded-lg border border-dashed border-line p-4 text-sm dark:border-line">
 <div className="flex items-center gap-2 font-medium text-subtle dark:text-subtle">
 <MessageCircle className="h-4 w-4" />
          WhatsApp integration unavailable.
        </div>
 <p className="text-subtle dark:text-faint">
          Contact an administrator to configure WhatsApp Business API.
        </p>
      </div>
    );
  }

  return (
 <div className="flex flex-col gap-3 rounded-lg border border-success/30 bg-success/10 p-4 dark:border-success/30 dark:bg-success/10">
 <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-success dark:text-success">
 <MessageCircle className="h-3.5 w-3.5" />
        WhatsApp
      </h3>

 <div className="text-sm text-subtle dark:text-subtle">
 {phone || <span className="text-subtle dark:text-faint">No phone number on file — add one before sending.</span>}
      </div>

 <div className="flex flex-wrap gap-1.5">
        {TEMPLATES.map((tpl) => (
          <button
            key={tpl.label}
            type="button"
            onClick={() => setMessage(tpl.build(firstNameOf(leadName)))}
 className="rounded-md border border-line px-2 py-1 text-xs text-subtle hover:bg-surface-2 dark:border-line dark:text-faint dark:hover:bg-surface-2"
          >
            {tpl.label}
          </button>
        ))}
      </div>

 <label className="flex flex-col gap-1">
 <span className="text-xs font-medium text-subtle dark:text-faint">Message</span>
        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={!phone}
          placeholder="Type the message to send…"
          maxLength={MAX_MESSAGE_LENGTH}
 className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent disabled:opacity-50 dark:border-line dark:bg-accent"
        />
 <span className="self-end text-xs text-faint">{trimmed.length}/{MAX_MESSAGE_LENGTH}</span>
      </label>

      {sendError && <ErrorState error={sendError} />}

      <div>
        <button
          type="button"
          onClick={openConfirm}
          disabled={!canOpenConfirm}
 className="flex items-center gap-1.5 rounded-md bg-success/10 px-4 py-1.5 text-sm font-medium text-white hover:bg-success/10 disabled:opacity-50 dark:bg-success/10 dark:hover:bg-success/10"
        >
 <Send className="h-3.5 w-3.5" />
          Send WhatsApp
        </button>
      </div>

      {confirmOpen && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
 <div className="w-full max-w-md rounded-lg border border-line bg-surface p-5 shadow-lg dark:border-line dark:bg-accent">
 <h4 className="text-sm font-semibold text-ink dark:text-ink">Send WhatsApp message?</h4>
 <div className="mt-3 flex flex-col gap-3 text-sm">
              <div>
 <div className="text-xs font-medium uppercase tracking-wide text-subtle dark:text-faint">To</div>
 <div className="text-ink dark:text-ink">{phone}</div>
              </div>
              <div>
 <div className="text-xs font-medium uppercase tracking-wide text-subtle dark:text-faint">Message</div>
 <p className="whitespace-pre-wrap rounded-md bg-surface-2 p-2 text-ink dark:bg-surface-2 dark:text-ink">
                  {trimmed}
                </p>
              </div>
            </div>
            {sendError && (
 <div className="mt-3">
                <ErrorState error={sendError} />
              </div>
            )}
 <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={isSending}
 className="rounded-md border border-line px-3 py-1.5 text-sm text-subtle hover:bg-surface-2 disabled:opacity-50 dark:border-line dark:text-subtle dark:hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSend}
                disabled={isSending}
 className="rounded-md bg-success/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-success/10 disabled:opacity-50"
              >
                {isSending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
