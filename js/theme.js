// Apparence : mode (auto / clair / sombre), couleur d'accent, transparence,
// animation d'ouverture. Le réglage est aussi copié dans localStorage pour que
// le script en tête de index.html l'applique avant le premier affichage.

export const ACCENTS = [
  { id: "indigo", label: "Indigo", color: "#4f46e5" },
  { id: "or", label: "Or", color: "#d97706" },
  { id: "emeraude", label: "Émeraude", color: "#059669" },
  { id: "ocean", label: "Océan", color: "#0284c7" },
  { id: "corail", label: "Corail", color: "#f43f5e" },
  { id: "prune", label: "Prune", color: "#a855f7" },
];

export const DEFAULT_THEME = { mode: "auto", accent: "indigo", glass: "full", splash: true };

const MIRROR_KEY = "sika:theme";

export function themeOf(settings) {
  return { ...DEFAULT_THEME, ...(settings?.theme || {}) };
}

export function applyTheme(theme) {
  const t = { ...DEFAULT_THEME, ...theme };
  const root = document.documentElement;
  if (t.mode === "auto") delete root.dataset.theme;
  else root.dataset.theme = t.mode;
  root.dataset.accent = ACCENTS.some((a) => a.id === t.accent) ? t.accent : "indigo";
  root.dataset.glass = t.glass === "lite" ? "lite" : "full";
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify(t));
  } catch {}
  // Couleur de la barre du navigateur, assortie au fond.
  const dark = t.mode === "dark" || (t.mode === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", dark ? "#0c0d1a" : "#eef0f8"));
}
