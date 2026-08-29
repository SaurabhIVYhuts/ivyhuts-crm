"use client";

// Client-side authentication state for the CRM. Combines two backend
// sources deliberately kept separate there (see src/types/auth.ts /
// src/types/customer.ts):
//   - the Redis session identity (GET /api/auth/me)          -> sessionUser
//   - the MongoDB business profile, incl. role (GET /api/customers/me) -> profile
//
// This is a UX convenience only. The backend re-derives identity from the
// session cookie and re-checks role on every request — nothing here should
// be treated as an authorization decision, only as what to render.
import { useCallback, useEffect, useState } from "react";
import { getCurrentCustomer } from "@/lib/api/customers";
import { getSessionUser, login as loginRequest, logout as logoutRequest } from "@/lib/auth";
import type { SessionUser } from "@/types/auth";
import type { CustomerProfile } from "@/types/customer";

interface AuthState {
  sessionUser: SessionUser | null;
  profile: CustomerProfile | null;
  isLoading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    sessionUser: null,
    profile: null,
    isLoading: true,
  });

  // Deliberately does not flip `isLoading` back to true synchronously on
  // entry — doing so from the effect below would call setState
  // synchronously within the effect body (flagged by react-hooks lint).
  // The initial state already starts `isLoading: true`, which covers the
  // mount case; a manual refresh() after login/logout resolves quickly
  // enough that skipping the interim loading flip is an acceptable
  // trade-off for this foundation shell.
  const refresh = useCallback(async () => {
    // getSessionUser only resolves null for a clean 401 (see
    // src/lib/auth/session.ts) — anything else (backend unreachable, a
    // 5xx, ...) rethrows. Without this catch, that rejection is never
    // handled here, isLoading never flips to false, and every
    // backend-driven page relying on this hook is stuck showing its
    // loading state forever instead of the login redirect. Treat "couldn't
    // determine the session" the same as "no session" for UI purposes —
    // this is not an authorization decision, just what to render.
    const sessionUser = await getSessionUser().catch(() => null);
    if (!sessionUser) {
      setState({ sessionUser: null, profile: null, isLoading: false });
      return;
    }
    const profileRes = await getCurrentCustomer().catch(() => null);
    setState({ sessionUser, profile: profileRes?.data ?? null, isLoading: false });
  }, []);

  useEffect(() => {
    // react-hooks/set-state-in-effect flags this because refresh()
    // eventually calls setState, even though every call is after an
    // `await` (never synchronous within this effect body). Fetching the
    // current session on mount is the correct use of an effect here; there
    // is no non-effect alternative for "run this once when the component
    // using this hook mounts."
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      await loginRequest(email, password);
      await refresh();
    },
    [refresh]
  );

  const logout = useCallback(async () => {
    await logoutRequest();
    setState({ sessionUser: null, profile: null, isLoading: false });
  }, []);

  return {
    sessionUser: state.sessionUser,
    profile: state.profile,
    isLoading: state.isLoading,
    isAuthenticated: state.sessionUser !== null,
    login,
    logout,
    refresh,
  };
}
