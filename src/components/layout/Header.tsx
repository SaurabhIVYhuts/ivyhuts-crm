"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Menu, Plus } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { AddLeadModal } from "@/components/leads/AddLeadModal";
import { SearchInput } from "@/components/ui/SearchInput";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { listLeads } from "@/lib/api/leads";
import { findNavLabel } from "@/lib/nav";
import { INTERNAL_ROLES, type Role } from "@/types/auth";
import type { Lead } from "@/types/lead";

function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Lead[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // No synchronous setResults([]) for an empty query — the render below
  // simply treats a blank query as "no results" directly (trimmedQuery
  // guards the dropdown), so there's nothing to clear; the next real query
  // overwrites `results` anyway. This avoids a synchronous setState at the
  // top of the effect (react-hooks/set-state-in-effect) the same way
  // FindRoomsSection.tsx's own identical comment describes.
  const trimmedQuery = query.trim();
  useEffect(() => {
    if (!trimmedQuery) return;
    let cancelled = false;
    const handle = setTimeout(() => {
      listLeads({ search: trimmedQuery, limit: 6 })
        .then((res) => {
          if (!cancelled) {
            setResults(res.data);
            setOpen(true);
          }
        })
        .catch(() => {
          // A failed lookahead search is non-critical — the full Lead Inbox
          // search (with its own error state) is still available.
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [trimmedQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative hidden w-full max-w-md sm:block">
      <SearchInput
        value={query}
        onChange={(v) => {
          setQuery(v);
          setOpen(true);
        }}
        placeholder="Search leads, customers, properties…"
      />
      {open && trimmedQuery && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-lg border border-line bg-surface-2 shadow-xl">
          {results.length === 0 ? (
            <p className="px-3.5 py-3 text-sm text-faint">No leads match &ldquo;{query}&rdquo;.</p>
          ) : (
            <ul>
              {results.map((lead) => (
                <li key={lead.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setQuery("");
                      router.push(`/dashboard/leads/${lead.id}`);
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm hover:bg-surface"
                  >
                    <Avatar name={lead.contact.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-ink">{lead.contact.name || "Unnamed lead"}</div>
                      <div className="truncate text-xs text-faint">{lead.contact.email || lead.contact.phone || "—"}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function Header({ onMenuClick, role }: { onMenuClick: () => void; role: Role | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { show } = useToast();
  const hasInternalRole = role ? INTERNAL_ROLES.includes(role) : false;
  const [addLeadOpen, setAddLeadOpen] = useState(false);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-canvas px-4 sm:px-6">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Toggle navigation"
          className="rounded-md p-1.5 text-subtle hover:bg-surface-2 hover:text-ink md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <h1 className="shrink-0 text-sm font-semibold text-ink">{findNavLabel(pathname)}</h1>

        <div className="flex flex-1 justify-center">
          <GlobalSearch />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {hasInternalRole && (
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setAddLeadOpen(true)} className="hidden sm:inline-flex">
              Add Lead
            </Button>
          )}
          {hasInternalRole && <NotificationBell />}
        </div>
      </header>

      {addLeadOpen && (
        <AddLeadModal
          onClose={() => setAddLeadOpen(false)}
          onCreated={(lead) => {
            setAddLeadOpen(false);
            show("Lead created.");
            router.push(`/dashboard/leads/${lead.id}`);
          }}
        />
      )}
    </>
  );
}
