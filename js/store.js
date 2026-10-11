// Persistance locale (localStorage) et migration des anciennes versions.
// Le module cloud.js s'abonne aux sauvegardes pour synchroniser avec le compte.

import { LEGACY_CATEGORY } from "./data.js";

const KEY = "sika:v2";
const LEGACY_KEY = "sika:v1";

export function emptyState() {
  return {
    version: 2,
    updatedAt: null,
    settings: {
      currency: "FCFA",
      name: "",
      savePercent: 10,
      goalForSavings: null,
      fees: null,
    },
    transactions: [],
    recurring: [],
    goals: [],
    budgets: {},
    tontines: [],
    debts: [],
  };
}

const listeners = new Set();
let memoryFallback = null;

/** Appelé à chaque sauvegarde locale (utilisé pour la synchronisation). */
export function onSave(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return emptyState();
    return normalize(JSON.parse(raw));
  } catch {
    return memoryFallback ?? emptyState();
  }
}

/** Enregistre l'état. `touch: false` pour une écriture venant du serveur (ne pas la renvoyer). */
export function save(state, { touch = true } = {}) {
  if (touch) state.updatedAt = new Date().toISOString();
  memoryFallback = state;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Stockage indisponible (navigation privée…) : on garde l'état en mémoire.
  }
  if (touch) listeners.forEach((fn) => fn(state));
}

/** L'état contient-il des données saisies par l'utilisateur ? */
export function hasData(state) {
  return Boolean(
    state.transactions.length || state.recurring.length || state.goals.length || state.tontines.length || state.debts.length,
  );
}

const arr = (v, keep) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object" && keep(x)) : []);
const migrateCategory = (c) => LEGACY_CATEGORY[c] || c;

/** Valide, complète et migre un état importé, relu ou téléchargé. */
export function normalize(data) {
  const base = emptyState();
  if (!data || typeof data !== "object") return base;
  const legacy = !data.version || data.version < 2;

  const transactions = arr(data.transactions, (t) => Number.isFinite(t.amount) && t.date).map((t) =>
    legacy ? { ...t, category: migrateCategory(t.category) } : t,
  );
  const recurring = arr(data.recurring, (r) => Number.isFinite(r.amount) && r.start && r.frequency).map((r) => ({
    remindDays: 2,
    // Les règles de la première version étaient toutes enregistrées automatiquement.
    auto: legacy ? true : r.auto !== false,
    ...r,
    category: legacy ? migrateCategory(r.category) : r.category,
  }));
  const budgets = {};
  for (const [k, v] of Object.entries(data.budgets && typeof data.budgets === "object" ? data.budgets : {})) {
    if (Number(v) > 0) budgets[legacy ? migrateCategory(k) : k] = Number(v);
  }

  return {
    version: 2,
    updatedAt: data.updatedAt || null,
    settings: { ...base.settings, ...(data.settings || {}) },
    transactions,
    recurring,
    goals: arr(data.goals, (g) => g.name && Number.isFinite(g.target)),
    budgets,
    tontines: arr(data.tontines, (t) => t.name && Array.isArray(t.members) && Number.isFinite(t.amount)).map((t) => ({ paid: {}, ...t })),
    debts: arr(data.debts, (d) => d.person && Number.isFinite(d.amount)).map((d) => ({ repayments: [], ...d })),
  };
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
