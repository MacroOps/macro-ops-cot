import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "solar" | "charcoal";
interface Ctx { theme: Theme; toggle: () => void; }

const ThemeCtx = createContext<Ctx | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("hud-theme") : null;
    return (stored as Theme) || "solar";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "charcoal");
    localStorage.setItem("hud-theme", theme);
  }, [theme]);

  return (
    <ThemeCtx.Provider value={{ theme, toggle: () => setTheme(t => t === "solar" ? "charcoal" : "solar") }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme outside provider");
  return ctx;
}
