import { useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark" | "kera" | "kera-premium";
const STORAGE_KEY = "kera:theme";
const THEME_CLASSES: Theme[] = ["light", "dark", "kera", "kera-premium"];

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  // Limpa todas as classes de tema antes de aplicar a nova
  THEME_CLASSES.forEach((t) => root.classList.remove(t));
  if (theme === "light") root.classList.add("light");
  else if (theme === "kera") root.classList.add("kera");
  else if (theme === "kera-premium") root.classList.add("kera-premium");
  // dark é o default (sem classe)
}

function getInitial(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved && (THEME_CLASSES as string[]).includes(saved)) return saved;
  } catch {}
  return "dark";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitial);

  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  // Cicla dark -> light -> kera -> kera-premium -> dark
  const toggle = useCallback(() => setThemeState((p) => {
    if (p === "dark") return "light";
    if (p === "light") return "kera";
    if (p === "kera") return "kera-premium";
    return "dark";
  }), []);

  return { theme, setTheme, toggle };
}
