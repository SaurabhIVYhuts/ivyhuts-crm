"use client";

// Light / dark theme (CRM plan item 1). The CRM shipped dark-only; this
// adds a real light palette (see globals.css) and lets the user pick
// light / dark / system. The choice is a per-browser convenience, stored
// in localStorage and applied as `data-theme` on <html> — never sent to
// the backend.
//
// A tiny inline script in app/layout.tsx applies the stored choice before
// first paint so there's no flash; this provider is what keeps it in sync
// after hydration and exposes the current value to the toggle.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "ivyhuts-crm:theme";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStored(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch {
    // Private mode / blocked storage — fall through to the default.
  }
  return "system";
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Always stamp a concrete "light" | "dark" on <html> — "system" is resolved
// to the current OS preference here. This keeps the CSS (`data-theme`
// selectors, the `dark:` variant) exhaustive without a parallel
// prefers-color-scheme branch, and matches what the pre-paint script does.
function apply(theme: Theme) {
  const resolved = theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;
  document.documentElement.setAttribute("data-theme", resolved);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start from "system" for a deterministic SSR/first render; the effect
  // below immediately reconciles with what the pre-paint script already
  // applied, so there's no visible flip.
  const [theme, setThemeState] = useState<Theme>("system");
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    // One-time reconcile on mount with the value the pre-paint script
    // already applied to <html> — not a cascading-render pattern (runs
    // once, no deps). Same known false-positive/fix as src/hooks/useAuth.ts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(readStored());
    setSystemDark(systemPrefersDark());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-fatal — the choice just won't persist to the next visit.
    }
    apply(next);
  }, []);

  // Re-apply on theme change AND when the OS preference changes while in
  // "system" mode (systemDark is a dep so this re-runs, and apply() reads
  // the live matchMedia value).
  useEffect(() => {
    apply(theme);
  }, [theme, systemDark]);

  const resolvedTheme: ResolvedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

// Inlined verbatim into <head> in app/layout.tsx (see its comment). Kept
// here next to STORAGE_KEY so the key can never drift between the two.
// Resolves "system"/unset to a concrete light|dark and stamps it before
// first paint, so the CSS never has to guess.
export const THEME_NO_FLASH_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;
