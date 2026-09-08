"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "./ThemeProvider";

// Three-way light / dark / system control for the header. Cycles on click;
// the icon shows the current setting (a monitor for "follow the OS").
const ORDER: Theme[] = ["light", "dark", "system"];
const NEXT_LABEL: Record<Theme, string> = {
  light: "Switch to dark theme",
  dark: "Switch to system theme",
  system: "Switch to light theme",
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <button
      type="button"
      onClick={() => setTheme(ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length])}
      aria-label={NEXT_LABEL[theme]}
      title={theme === "system" ? "Theme: system" : `Theme: ${theme}`}
      className="rounded-md p-1.5 text-subtle hover:bg-surface-2 hover:text-ink"
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
