// Utilitaires d'affichage partagés par les écrans.

import { category, FREQUENCIES } from "./data.js";
import { daysUntil } from "./calc.js";

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const numberFmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
let currency = "FCFA";
export const setCurrency = (c) => (currency = c || "FCFA");
export const cur = () => esc(currency);
export const num = (n) => numberFmt.format(Math.round(n || 0));
export const money = (n) => `${num(n)} ${esc(currency)}`;
export const signed = (n, type) => `${type === "income" ? "+" : "−"}${money(n)}`;
/** Montant mis en valeur : gros chiffres, devise en petit. */
export const bigMoney = (n, cls = "") =>
  `<span class="big-money ${cls}" data-count="${Math.round(n || 0)}"><span class="n">${num(n)}</span><span class="cur">${esc(currency)}</span></span>`;

let counted = false;

/**
 * Fait défiler les gros montants de 0 jusqu'à leur valeur (une seule fois par
 * ouverture de l'application, juste après l'animation d'ouverture).
 */
export function countUp(root) {
  if (counted) return;
  counted = true;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (const el of root.querySelectorAll(".big-money[data-count]")) {
    const target = Number(el.dataset.count) || 0;
    const out = el.querySelector(".n");
    if (!out || target === 0) continue;
    const start = performance.now();
    const duration = 1100;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      out.textContent = num(target * eased);
      if (t < 1) requestAnimationFrame(step);
    };
    out.textContent = num(0);
    requestAnimationFrame(step);
  }
}

/** Bouton en chargement : se rétracte en pastille avec trois points qui rebondissent. */
export function setLoading(btn, on) {
  if (on) {
    btn.dataset.label = btn.innerHTML;
    btn.style.width = `${btn.offsetWidth}px`;
    btn.innerHTML = `<span class="load-dots" aria-label="Chargement"><i></i><i></i><i></i></span>`;
    btn.classList.add("loading");
    requestAnimationFrame(() => (btn.style.width = "92px"));
  } else if (btn.classList.contains("loading")) {
    btn.classList.remove("loading");
    btn.style.width = "";
    btn.innerHTML = btn.dataset.label || "";
  }
}
export const pct = (n) => `${Math.round(n * 100)} %`;

export const isoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const today = () => isoDate(new Date());
const asDate = (iso) => new Date(iso + "T00:00:00");
export const fmtDate = (iso, opts = { day: "numeric", month: "short", year: "numeric" }) =>
  asDate(iso).toLocaleDateString("fr-FR", opts);
export const fmtShort = (iso) => fmtDate(iso, { day: "numeric", month: "short" });
export const fmtLong = (iso) => fmtDate(iso, { weekday: "long", day: "numeric", month: "long" });
export const monthLabel = (key) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
};
export const monthShort = (key) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
};

/** Badge d'échéance : EN RETARD, AUJOURD'HUI, DEMAIN, 3 JOURS… */
export function dueBadge(date, ref = today()) {
  const d = daysUntil(ref, date);
  if (d < 0) return `<span class="badge late">En retard</span>`;
  if (d === 0) return `<span class="badge today">Aujourd'hui</span>`;
  if (d === 1) return `<span class="badge soon">Demain</span>`;
  if (d <= 7) return `<span class="badge soon">${d} jours</span>`;
  return "";
}

export const freqLabel = (f) => FREQUENCIES[f]?.label || f;
export const freqUnit = (f) => FREQUENCIES[f]?.unit || "";

/** Tuile d'icône de catégorie (emoji sur fond teinté). */
export function catIcon(id, size = "") {
  const c = category(id);
  return `<span class="cat-icon ${size}" style="--c:${c.color}" aria-hidden="true">${c.icon}</span>`;
}

/** Tuile avec initiales (personnes, tontines). */
export function initialsIcon(name, color = "#4f46e5") {
  const ini = String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
  return `<span class="cat-icon initials" style="--c:${color}" aria-hidden="true">${esc(ini || "?")}</span>`;
}

// ---------- Icônes (traits, 24×24) ----------

const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  piggy: '<path d="M19 9.5c.8.3 1.5.9 2 1.5v3h-1.6c-.5 1-1.2 1.8-2.1 2.4V19h-3v-1.6a8 8 0 0 1-3.6 0V19h-3v-2.6A6 6 0 0 1 4 11.5C4 8 7.6 5.5 11.5 5.5c2 0 3.6.5 4.9 1.4L18.5 5v4.5z"/><circle cx="15.5" cy="10.5" r=".6" fill="currentColor"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  up: '<path d="M18 15l-6-6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M17.5 14a5 5 0 0 1 4 5"/>',
  swap: '<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.6A3.8 3.8 0 0 1 17.5 18z"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  arrowUpRight: '<path d="M7 17 17 7M8 7h9v9"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2 0-1.4-1-1.7-1-3 0-1 .8-2 2-2h2a4 4 0 0 0 4-4c0-4-4-7-9-7z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10" cy="7" r="1.2" fill="currentColor"/><circle cx="15" cy="7.5" r="1.2" fill="currentColor"/>',
  logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3"/>',
};

export const icon = (name, cls = "") =>
  `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;

// ---------- Feuille du bas (bottom sheet) ----------

let sheetCleanup = null;

/**
 * Ouvre une feuille modale en bas de l'écran. `bind(root, close)` branche les
 * événements ; renvoie une fonction de nettoyage facultative.
 */
export function openSheet(title, html, bind) {
  closeSheet();
  const wrap = document.createElement("div");
  wrap.className = "sheet-wrap";
  wrap.innerHTML = `
    <div class="sheet-backdrop" data-close></div>
    <section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-grab" aria-hidden="true"></div>
      <header class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Fermer">${icon("close")}</button></header>
      <div class="sheet-body">${html}</div>
    </section>`;
  document.body.append(wrap);
  document.body.classList.add("sheet-open");
  requestAnimationFrame(() => wrap.classList.add("open"));
  const onKey = (e) => e.key === "Escape" && closeSheet();
  document.addEventListener("keydown", onKey);
  wrap.addEventListener("click", (e) => e.target.closest("[data-close]") && closeSheet());
  const extra = bind?.(wrap.querySelector(".sheet-body"), closeSheet);
  sheetCleanup = () => {
    document.removeEventListener("keydown", onKey);
    extra?.();
    wrap.classList.remove("open");
    document.body.classList.remove("sheet-open");
    setTimeout(() => wrap.remove(), 220);
  };
  setTimeout(() => wrap.querySelector("[autofocus]")?.focus({ preventScroll: true }), 230);
  return wrap;
}

export function closeSheet() {
  sheetCleanup?.();
  sheetCleanup = null;
}

// ---------- Toast ----------

export function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = Object.assign(document.createElement("div"), { id: "toast", role: "status" });
    el.setAttribute("aria-live", "polite");
    document.body.append(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2400);
}

/** Barre de progression. */
export function bar(ratio, cls = "") {
  const w = Math.max(0, Math.min(1, ratio || 0)) * 100;
  return `<div class="bar ${cls}"><i style="width:${w}%"></i></div>`;
}

/** Interrupteur accessible. */
export const toggle = (name, checked, label) =>
  `<label class="switch"><input type="checkbox" name="${name}" ${checked ? "checked" : ""} aria-label="${esc(label)}"><span></span></label>`;

/** Lit un champ numérique (accepte espaces et virgule). */
export const readAmount = (v) => Number(String(v).replace(/\s/g, "").replace(",", "."));
