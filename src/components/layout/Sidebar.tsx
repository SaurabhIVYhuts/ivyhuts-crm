"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, LogOut } from "lucide-react";
import { NAV_GROUPS } from "@/lib/nav";
import { Avatar } from "@/components/ui/Avatar";
import type { SessionUser } from "@/types/auth";
import type { Role } from "@/types/auth";

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  open = true,
  onNavigate,
  user,
  role,
  onLogout,
}: {
  open?: boolean;
  onNavigate?: () => void;
  user: SessionUser;
  role: Role | null;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex shrink-0 -translate-x-full flex-col border-r border-line bg-sidebar transition-[transform,width] duration-200 md:static md:translate-x-0 ${
        open ? "translate-x-0" : ""
      } ${collapsed ? "w-18" : "w-64"}`}
    >
      <div className={`flex h-16 shrink-0 items-center border-b border-line-soft px-4 ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-xs font-bold text-white">IH</div>
            <span className="text-sm font-semibold tracking-tight text-ink">IVYHUTS</span>
          </div>
        )}
        {collapsed && <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-xs font-bold text-white">IH</div>}
        {!collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar"
            className="hidden rounded-md p-1 text-faint hover:bg-surface-2 hover:text-ink md:block"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Expand sidebar"
            className="mb-3 flex w-full items-center justify-center rounded-lg p-2 text-faint hover:bg-surface-2 hover:text-ink"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        )}
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            {!collapsed && (
              <div className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-faint">{group.label}</div>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map(({ label, icon: Icon, href }) => {
                if (!href) {
                  return (
                    <div
                      key={label}
                      title={collapsed ? `${label} — not yet available` : "Not yet available for this account"}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-faint/70 ${collapsed ? "justify-center" : ""}`}
                    >
                      <Icon className="h-4.5 w-4.5 shrink-0" />
                      {!collapsed && <span className="truncate">{label}</span>}
                    </div>
                  );
                }
                const active = isActive(pathname, href);
                return (
                  <Link
                    key={label}
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? label : undefined}
                    className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                      collapsed ? "justify-center" : ""
                    } ${active ? "bg-accent/10 text-ink" : "text-subtle hover:bg-surface-2 hover:text-ink"}`}
                  >
                    <Icon className={`h-4.5 w-4.5 shrink-0 ${active ? "text-accent-strong" : "text-faint group-hover:text-subtle"}`} />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="relative shrink-0 border-t border-line-soft p-3">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className={`flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-surface-2 ${collapsed ? "justify-center" : ""}`}
        >
          <Avatar name={user.name} size="md" />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">{user.name}</div>
              <div className="truncate text-xs text-faint">{role ? role.replace(/_/g, " ") : "No role"}</div>
            </div>
          )}
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden="true" />
            <div
              className={`absolute z-20 rounded-lg border border-line bg-surface-2 p-1 shadow-xl ${
                collapsed ? "bottom-3 left-19 w-44" : "bottom-16 left-3 right-3"
              }`}
            >
              <button
                type="button"
                onClick={onLogout}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-subtle hover:bg-surface hover:text-ink"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
