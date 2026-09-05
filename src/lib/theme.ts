// Phase 18 — Dark mode. Persist + listen for changes.
const KEY = "mycase.theme";
export type Theme = "light" | "dark" | "system";

const listeners = new Set<() => void>();

const getSystem = (): "light" | "dark" =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

export const getTheme = (): Theme => {
  if (typeof localStorage === "undefined") return "system";
  return (localStorage.getItem(KEY) as Theme) || "system";
};

export const resolveTheme = (t: Theme = getTheme()): "light" | "dark" =>
  t === "system" ? getSystem() : t;

export const applyTheme = (t: Theme = getTheme()) => {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(t);
  document.documentElement.classList.toggle("dark", resolved === "dark");
};

export const setTheme = (t: Theme) => {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* ignore */
  }
  applyTheme(t);
  listeners.forEach((l) => l());
};

export const onThemeChange = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
