// Persistance locale (localStorage) et migration des anciennes versions.
// Le module cloud.js s'abonne aux sauvegardes pour synchroniser avec le compte.

import { LEGACY_CATEGORY, CATEGORY_BY_ID, PAYMENT_METHODS } from "./data.js";

const KEY = "sika:v2";
const LEGACY_KEY = "sika:v1";

export function emptyState() {
  return {
    version: 2,
    updatedAt: null,
    settings: {
      currency: "FCFA",
      name: "",
      firstName: "",
      lastName: "",
      onboarded: false,
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

// ---------- Validation stricte des données ----------
// Toute donnée qui entre (fichier importé, copie du compte en ligne, stockage du
// téléphone) passe par normalize() : chaque enregistrement est reconstruit avec
// les seuls champs attendus, chacun vérifié. Rien d'autre n'atteint l'affichage.

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z?$/;
const FREQS = ["weekly", "monthly", "bimonthly", "quarterly", "yearly"];

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const list = (v) => (Array.isArray(v) ? v.filter(isObj) : []);
const id = (v) => (typeof v === "string" && ID_RE.test(v) ? v : null);
const date = (v) => (typeof v === "string" && DATE_RE.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);
const str = (v, max = 120) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v, min = -Infinity, max = Infinity) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
const int = (v, min, max) => {
  const n = num(v, min, max);
  return n === null ? null : Math.trunc(n);
};
const oneOf = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);
const bool = (v) => v === true;
/** Ajoute les champs optionnels seulement s'ils sont valides. */
const withOptional = (obj, extra) => {
  for (const [k, v] of Object.entries(extra)) if (v !== null && v !== undefined) obj[k] = v;
  return obj;
};

function cleanCategory(c, type, legacy) {
  const idc = legacy ? LEGACY_CATEGORY[c] || c : c;
  const cat = CATEGORY_BY_ID[idc];
  if (cat && cat.type === type) return idc;
  return type === "income" ? "autre_revenu" : "autre_depense";
}

function cleanTransaction(t, legacy) {
  const amount = num(t.amount, 0, 1e12);
  const d = date(t.date);
  if (amount === null || !d) return null;
  const type = oneOf(t.type, ["income", "expense"], "expense");
  return withOptional(
    {
      id: id(t.id) || uid(),
      type,
      amount,
      category: cleanCategory(t.category, type, legacy),
      date: d,
      note: str(t.note),
      method: oneOf(t.method, Object.keys(PAYMENT_METHODS), ""),
    },
    { recurringId: id(t.recurringId), goalId: id(t.goalId), tontineId: id(t.tontineId), debtId: id(t.debtId), round: int(t.round, 0, 1000) },
  );
}

function cleanRule(r, legacy) {
  const amount = num(r.amount, 0, 1e12);
  const start = date(r.start);
  const frequency = oneOf(r.frequency, FREQS, null);
  if (amount === null || !start || !frequency) return null;
  const type = oneOf(r.type, ["income", "expense"], "expense");
  return withOptional(
    {
      id: id(r.id) || uid(),
      type,
      amount,
      category: cleanCategory(r.category, type, legacy),
      note: str(r.note, 60) || "Paiement",
      frequency,
      start,
      end: date(r.end),
      lastRun: date(r.lastRun),
      paused: bool(r.paused),
      // Les règles de la première version étaient toutes enregistrées automatiquement.
      auto: legacy ? true : r.auto !== false,
      variable: bool(r.variable),
      remindDays: int(r.remindDays, 0, 30) ?? 2,
    },
    { goalId: id(r.goalId), created: date(r.created), pausedReason: oneOf(r.pausedReason, ["goal_reached", "goal_deleted"], null) },
  );
}

function cleanGoal(g) {
  const target = num(g.target, 0, 1e12);
  const name = str(g.name, 60);
  const deadline = date(g.deadline);
  if (target === null || !name || !deadline) return null;
  return withOptional(
    { id: id(g.id) || uid(), name, icon: str(g.icon, 8) || "🎯", target, saved: num(g.saved, 0, 1e12) ?? 0, deadline, rate: num(g.rate, 0, 1) ?? 0 },
    { created: date(g.created) },
  );
}

function cleanTontine(t) {
  const amount = num(t.amount, 0, 1e12);
  const name = str(t.name, 40);
  const start = date(t.start);
  const members = Array.isArray(t.members) ? t.members.filter((m) => typeof m === "string" && m.trim()).map((m) => m.slice(0, 40)).slice(0, 200) : [];
  if (amount === null || !name || !start || members.length < 1) return null;
  const paid = {};
  if (isObj(t.paid)) {
    for (const [round, who] of Object.entries(t.paid)) {
      const r = int(round, 0, members.length - 1);
      if (r === null || !Array.isArray(who)) continue;
      paid[r] = [...new Set(who.map((w) => int(w, 0, members.length - 1)).filter((w) => w !== null))].sort((a, b) => a - b);
    }
  }
  return {
    id: id(t.id) || uid(),
    name,
    amount,
    frequency: oneOf(t.frequency, ["weekly", "monthly"], "monthly"),
    start,
    members,
    myIndex: int(t.myIndex, 0, members.length - 1) ?? 0,
    paid,
    received: bool(t.received),
  };
}

function cleanDebt(d) {
  const amount = num(d.amount, 0, 1e12);
  const person = str(d.person, 40);
  if (amount === null || !person) return null;
  const repayments = list(d.repayments)
    .map((r) => {
      const a = num(r.amount, 0, 1e12);
      const dt = date(r.date);
      return a === null || !dt ? null : { id: id(r.id) || uid(), amount: a, date: dt };
    })
    .filter(Boolean);
  return {
    id: id(d.id) || uid(),
    direction: oneOf(d.direction, ["lent", "borrowed"], "lent"),
    person,
    amount,
    date: date(d.date) || new Date().toISOString().slice(0, 10),
    due: date(d.due),
    note: str(d.note, 80),
    repayments,
  };
}

function cleanFees(fees) {
  if (!isObj(fees)) return null;
  const out = {};
  for (const op of ["wave", "orange", "mtn", "moov"]) {
    if (!isObj(fees[op])) continue;
    out[op] = {};
    for (const kind of ["send", "withdraw"]) {
      const f = fees[op][kind];
      if (isObj(f)) out[op][kind] = { rate: num(f.rate, 0, 100) ?? 0, cap: num(f.cap, 0, 1e9) ?? 0 };
    }
  }
  return out;
}

function cleanSettings(s, base) {
  if (!isObj(s)) return base;
  const theme = isObj(s.theme)
    ? {
        mode: oneOf(s.theme.mode, ["auto", "light", "dark"], "auto"),
        accent: typeof s.theme.accent === "string" && /^[a-z]{1,20}$/.test(s.theme.accent) ? s.theme.accent : "indigo",
        glass: oneOf(s.theme.glass, ["full", "lite"], "full"),
        splash: s.theme.splash !== false,
      }
    : undefined;
  return withOptional(
    {
      ...base,
      currency: str(s.currency, 6) || base.currency,
      name: str(s.name, 40),
      firstName: str(s.firstName, 40),
      lastName: str(s.lastName, 40),
      onboarded: bool(s.onboarded),
      savePercent: num(s.savePercent, 0, 100) ?? base.savePercent,
      goalForSavings: id(s.goalForSavings),
      fees: cleanFees(s.fees),
    },
    { theme },
  );
}

/** Valide, complète et migre un état importé, relu ou téléchargé. */
export function normalize(data) {
  const base = emptyState();
  if (!isObj(data)) return base;
  const legacy = !data.version || data.version < 2;
  const clean = (items, fn) => list(items).map(fn).filter(Boolean);

  const budgets = {};
  if (isObj(data.budgets)) {
    for (const [k, v] of Object.entries(data.budgets)) {
      const key = legacy ? LEGACY_CATEGORY[k] || k : k;
      const amount = num(v, 0, 1e12);
      if (CATEGORY_BY_ID[key]?.type === "expense" && amount > 0) budgets[key] = amount;
    }
  }

  return {
    version: 2,
    updatedAt: typeof data.updatedAt === "string" && ISO_RE.test(data.updatedAt) ? data.updatedAt : null,
    settings: cleanSettings(data.settings, base.settings),
    transactions: clean(data.transactions, (t) => cleanTransaction(t, legacy)),
    recurring: clean(data.recurring, (r) => cleanRule(r, legacy)),
    goals: clean(data.goals, cleanGoal),
    budgets,
    tontines: clean(data.tontines, cleanTontine),
    debts: clean(data.debts, cleanDebt),
  };
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
