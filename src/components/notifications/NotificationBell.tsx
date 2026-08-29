"use client";

// Milestone 23.14 — the CRM's first notification UI. Internal CRM
// notification only (see src/types/notification.ts) — not a browser push
// notification, never requests browser permission. Polls on a fixed
// interval rather than any push mechanism, since no realtime transport
// exists in this codebase.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { listNotifications, markNotificationRead } from "@/lib/api/notifications";
import type { Notification } from "@/types/notification";
import { formatDateTime } from "@/lib/utils/format";

const POLL_INTERVAL_MS = 60_000;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    listNotifications()
      .then((res) => {
        setNotifications(res.data);
        setUnreadCount(res.unreadCount);
      })
      .catch(() => {
        // Non-critical background poll — never surface an error UI for this.
      });
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleOpenNotification(notification: Notification) {
    setOpen(false);
    if (!notification.readAt) {
      try {
        await markNotificationRead(notification.id);
        setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // Non-critical — navigation still proceeds even if marking read fails.
      }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative rounded-md p-2 text-subtle hover:bg-surface-2 hover:text-ink"
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-line bg-surface-2 shadow-2xl">
          <div className="border-b border-line px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wide text-faint">
            Notifications
          </div>
          {notifications.length === 0 ? (
            <p className="px-3.5 py-6 text-center text-sm text-subtle">No notifications yet.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-line-soft overflow-y-auto">
              {notifications.map((n) => {
                const content = (
                  <div className={`flex flex-col gap-0.5 px-3.5 py-3 text-sm ${!n.readAt ? "bg-accent/5" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-ink">{n.title}</span>
                      {!n.readAt && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                    </div>
                    <span className="text-xs text-subtle">{n.message}</span>
                    <span className="text-[11px] text-faint">{formatDateTime(n.createdAt)}</span>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.actionHref ? (
                      <Link href={n.actionHref} onClick={() => handleOpenNotification(n)} className="block hover:bg-surface">
                        {content}
                      </Link>
                    ) : (
                      <button type="button" onClick={() => handleOpenNotification(n)} className="block w-full text-left hover:bg-surface">
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
