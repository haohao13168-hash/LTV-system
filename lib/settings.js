"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export const STORAGE_KEY = "marketing-dashboard-settings";

// Shared 8-color palette used for both the global Accent Color setting
// and per-company avatar colors.
export const PALETTE = [
  { id: "coral",     name: "Coral",      hsl: "5 80% 70%"   },
  { id: "lavender",  name: "Lavender",   hsl: "265 75% 75%" },
  { id: "pink",      name: "Pink",       hsl: "330 80% 65%" },
  { id: "deepCyan",  name: "Deep Cyan",  hsl: "190 90% 38%" },
  { id: "lightCyan", name: "Light Cyan", hsl: "190 85% 62%" },
  { id: "gold",      name: "Gold",       hsl: "48 95% 58%"  },
  { id: "amberGold", name: "Amber Gold", hsl: "35 88% 52%"  },
  { id: "emerald",   name: "Emerald",    hsl: "155 65% 48%" },
];

export const ACCENT_OPTIONS = PALETTE;
export const AVATAR_COLOR_OPTIONS = PALETTE;

export const THEMES = ["dark", "light"];
export const FONT_SIZES = ["sm", "md", "lg"];

export const defaultSettings = {
  brandName: "Marketing Console",
  brandInitial: "M",
  accent: "lightCyan",
  theme: "dark",
  fontSize: "md",
};

export function getPaletteColor(id) {
  return PALETTE.find((a) => a.id === id) || PALETTE[0];
}

function findAccent(id) {
  return getPaletteColor(id);
}

function applyToDom(settings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", settings.theme);
  root.setAttribute("data-font-size", settings.fontSize);
  root.style.setProperty("--color-accent", findAccent(settings.accent).hsl);
}

const SettingsContext = createContext({
  settings: defaultSettings,
  update: () => {},
  reset: () => {},
});

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(defaultSettings);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage on mount (with migration for old accent ids)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const migrate = {
          blue: "lightCyan", indigo: "lavender", violet: "lavender",
          orange: "amberGold", amber: "gold", green: "emerald", teal: "deepCyan",
        };
        if (parsed.accent && migrate[parsed.accent]) parsed.accent = migrate[parsed.accent];
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch {}
    setHydrated(true);
  }, []);

  // Apply to DOM whenever settings change
  useEffect(() => {
    applyToDom(settings);
  }, [settings]);

  const update = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setSettings(defaultSettings);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, update, reset, hydrated }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
