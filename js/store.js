// Persistance locale des données (localStorage). Rien ne quitte le navigateur.

const KEY = "sika:v1";

export const DEFAULT_CATEGORIES = {
  income: ["Salaire", "Activité secondaire", "Cadeau", "Autre revenu"],
  expense: [
    "Logement",
    "Alimentation",
    "Transport",
    "Santé",
    "Éducation",
    "Communication",
    "Loisirs",
    "Famille",
    "Épargne",
    "Autre dépense",
  ],
};

function emptyState() {
  return {
    settings: { currency: "FCFA" },
    transactions: [],
    goals: [],
    budgets: {},
  };
}

let memoryFallback = null;

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    return normalize(JSON.parse(raw));
  } catch {
    return memoryFallback ?? emptyState();
  }
}

export function save(state) {
  memoryFallback = state;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Stockage indisponible (navigation privée…) : on garde l'état en mémoire.
  }
}

/** Valide et complète un état importé ou relu depuis le stockage. */
export function normalize(data) {
  const base = emptyState();
  if (!data || typeof data !== "object") return base;
  return {
    settings: { ...base.settings, ...(data.settings || {}) },
    transactions: Array.isArray(data.transactions)
      ? data.transactions.filter((t) => t && Number.isFinite(t.amount) && t.date)
      : [],
    goals: Array.isArray(data.goals)
      ? data.goals.filter((g) => g && g.name && Number.isFinite(g.target))
      : [],
    budgets: data.budgets && typeof data.budgets === "object" ? data.budgets : {},
  };
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
