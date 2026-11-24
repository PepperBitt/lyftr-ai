export type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "lyftr_theme";

/**
 * Get the initial theme from localStorage, or fall back to system preference.
 */
export function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";

  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") {
      return saved;
    }
  } catch {
    // Ignore localStorage access issues
  }

  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "light";
  }

  return "dark";
}

/**
 * Apply the theme to the document element (adds or removes 'dark' class)
 * and persist the user's choice to localStorage.
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore localStorage access issues
  }
}
