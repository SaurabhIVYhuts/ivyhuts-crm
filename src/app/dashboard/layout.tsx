"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ToastProvider } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";
import { INTERNAL_ROLES } from "@/types/auth";

// Protects every /dashboard/* route in one place (auth check + shell) so
// individual pages don't each duplicate the redirect-to-/login logic. This
// is a UX convenience only — the backend re-checks the session/role on
// every API call it receives, so this is not a security boundary.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { sessionUser, profile, isLoading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !sessionUser) {
      router.replace("/login");
    }
  }, [isLoading, sessionUser, router]);

  if (isLoading || !sessionUser) {
    return <div className="flex flex-1 items-center justify-center bg-canvas text-sm text-subtle">Loading…</div>;
  }

  const hasInternalRole = profile ? INTERNAL_ROLES.includes(profile.role) : false;

  return (
    <ToastProvider>
      <div className="flex flex-1 overflow-hidden bg-canvas">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        <Sidebar
          open={sidebarOpen}
          onNavigate={() => setSidebarOpen(false)}
          user={sessionUser}
          role={profile?.role ?? null}
          onLogout={() => logout().then(() => router.replace("/login"))}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header onMenuClick={() => setSidebarOpen((v) => !v)} role={profile?.role ?? null} />
          <main className="flex-1 overflow-y-auto">
            {!hasInternalRole && (
              <div className="border-b border-warning/20 bg-warning-soft px-4 py-3 text-sm text-warning sm:px-8">
                This account doesn&apos;t hold a MARKETING_AGENT, MARKETING_MANAGER, or ADMIN
                role, so most CRM data will be unavailable until the backend grants one.
              </div>
            )}
            <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
