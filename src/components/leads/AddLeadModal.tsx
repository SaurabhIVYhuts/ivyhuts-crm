"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { createLead } from "@/lib/api/leads";
import { describeApiError, type ApiErrorState } from "@/lib/utils/errors";
import type { Lead } from "@/types/lead";

// Manual lead creation — POST /api/leads already existed on the backend
// (src/lib/api/leads.ts's createLead) but had no UI trigger anywhere in
// this CRM; every lead previously only arrived via webhook/import. This is
// the first real form for it, not a new endpoint.
const SOURCE_OPTIONS = ["walk_in", "referral", "whatsapp", "website", "phone_call", "other"];

export function AddLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: (lead: Lead) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<ApiErrorState | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const res = await createLead({
        contact: { name: name.trim() || undefined, email: email.trim() || undefined, phone: phone.trim() || undefined },
        source: source || undefined,
        notes: notes.trim() || undefined,
      });
      onCreated(res.data);
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setIsSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-faint focus:border-accent";
  const labelClass = "mb-1 block text-xs font-medium text-subtle";

  return (
    <Modal title="Add Lead" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div>
          <label className={labelClass}>Name</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Student's full name" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Email</label>
            <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" />
          </div>
        </div>
        <div>
          <label className={labelClass}>Source</label>
          <select className={inputClass} value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Select a source…</option>
            {SOURCE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Notes (optional)</label>
          <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {error && <ErrorState error={error} />}

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSaving}>
            {isSaving ? "Creating…" : "Create Lead"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
