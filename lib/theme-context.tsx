"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "dark" | "light";

type ThemeCtx = {
  theme: ThemeMode;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeCtx | null>(null);

const STORAGE_KEY = "facegate-theme";

function applyThemeClass(theme: ThemeMode) {
  const el = document.documentElement;
  el.classList.remove("light", "dark");
  el.classList.add(theme);
}

function prefersTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia?.("(prefers-color-scheme: light)")?.matches
    ? "light"
    : "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    try {
      const existing = window.localStorage.getItem(STORAGE_KEY);
      const initial =
        existing === "light" || existing === "dark"
          ? (existing as ThemeMode)
          : prefersTheme();
      setTheme(initial);
      applyThemeClass(initial);
    } catch {
      applyThemeClass("dark");
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
    applyThemeClass(theme);
  }, [theme]);

  const value = useMemo<ThemeCtx>(
    () => ({
      theme,
      toggleTheme: () =>
        setTheme((t) => (t === "dark" ? "light" : "dark")),
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return { theme: "dark", toggleTheme: () => undefined };
  }
  return ctx;
}

