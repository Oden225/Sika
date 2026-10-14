import * as calc from "./calc.js";
import * as act from "./actions.js";
import { load, save } from "./store.js";
import { cloud, initCloud } from "./cloud.js";
import { $, $$, setCurrency, today, closeSheet, countUp } from "./ui.js";
import { applyTheme, themeOf } from "./theme.js";
import { openAddSheet } from "./sheets.js";
import { home } from "./screens/home.js";
import { calendar } from "./screens/calendar.js";
import { bills, billDetail } from "./screens/bills.js";
import { savings, goalDetail, simulator } from "./screens/savings.js";
import { tontines, tontineDetail, debts, debtDetail } from "./screens/community.js";
import { analytics, budgets } from "./screens/analytics.js";
import { more, transactions, reminders, settings } from "./screens/more.js";
import { account } from "./screens/account.js";

let state = load();
const thisMonth = calc.monthKey(new Date());

/** État d'interface (non enregistré). */
const ui = {
  month: thisMonth,
  calMonth: thisMonth,
  calDay: null,
  txFilter: thisMonth,
  txSearch: "",
  sim: { initial: 0, monthly: 25000, rate: 3.5, years: 10 },
};

const ctx = {
  get state() {
    return state;
  },
  ui,
  cloud,
  commit,
  render,
  navigate,
  replaceState,
};

function commit() {
  save(state);
  render();
}

/** Remplace tout l'état (import, effacement, données du compte). */
function replaceState(next, { fromCloud = false } = {}) {
  state = next;
  applyTheme(themeOf(state.settings));
  act.applyRecurring(state, today());
  save(state, { touch: !fromCloud });
  render();
}

function navigate(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

// ---------- Routes ----------

const routes = [
  [/^#?\/?$/, home, "home"],
  [/^#\/calendrier$/, calendar, "calendar"],
  [/^#\/paiements$/, bills, "home"],
  [/^#\/paiement\/([\w-]+)$/, billDetail, "home"],
  [/^#\/epargne$/, savings, "savings"],
  [/^#\/objectif\/([\w-]+)$/, goalDetail, "savings"],
  [/^#\/simulateur$/, simulator, "savings"],
  [/^#\/plus$/, more, "more"],
  [/^#\/tontines$/, tontines, "more"],
  [/^#\/tontine\/([\w-]+)$/, tontineDetail, "more"],
  [/^#\/dettes$/, debts, "more"],
  [/^#\/dette\/([\w-]+)$/, debtDetail, "more"],
  [/^#\/analyses$/, analytics, "home"],
  [/^#\/budgets$/, budgets, "home"],
  [/^#\/transactions$/, transactions, "home"],
  [/^#\/rappels$/, reminders, "home"],
  [/^#\/reglages$/, settings, "more"],
  [/^#\/compte$/, account, "more"],
];

const view = $("#view");
let lastHash = null;

function render() {
  setCurrency(state.settings.currency);
  const hash = location.hash || "#/";
  // Pendant l'animation du code de vérification, on ne redessine pas l'écran.
  if (ui.holdRender && hash === lastHash) return;
  ui.holdRender = false;
  const [re, screen, tab] = routes.find(([r]) => r.test(hash)) || routes[0];
  const params = hash.match(re)?.slice(1) || [];
  const { html, bind } = screen(ctx, ...params);
  const sameRoute = hash === lastHash;
  const scroll = window.scrollY;
  view.innerHTML = html;
  bind?.(view);
  $$(".tabbar [data-tab]").forEach((a) => a.classList.toggle("active", a.dataset.tab === tab));
  window.scrollTo(0, sameRoute ? scroll : 0);
  if (!sameRoute) {
    closeSheet();
    view.classList.remove("enter");
    void view.offsetWidth;
    view.classList.add("enter");
  }
  lastHash = hash;
}

window.addEventListener("hashchange", render);
$("[data-add-main]").addEventListener("click", () => openAddSheet(ctx, "expense"));

// ---------- Échéances et notifications ----------

/** Ajoute les paiements automatiques dus et prévient des paiements proches. */
function checkDue() {
  if (act.applyRecurring(state, today())) save(state);
  notifyReminders();
}

async function notifyReminders() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const day = today();
  let sent = {};
  try {
    sent = JSON.parse(localStorage.getItem("sika:notified") || "{}");
  } catch {}
  if (sent.day !== day) sent = { day, ids: [] };
  const fresh = calc.reminders(state, day).filter((r) => !sent.ids.includes(`${r.kind}:${r.id}:${r.date}`));
  if (!fresh.length) return;
  const title = fresh.length === 1 ? fresh[0].title : `${fresh.length} paiements à prévoir`;
  const body = fresh
    .slice(0, 4)
    .map((r) => `${r.title} · ${r.daysLeft < 0 ? "en retard" : r.daysLeft === 0 ? "aujourd'hui" : `dans ${r.daysLeft} j`}`)
    .join("\n");
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon: "icons/icon-192.png", tag: "sika-rappels" });
    else new Notification(title, { body, icon: "icons/icon-192.png" });
    sent.ids.push(...fresh.map((r) => `${r.kind}:${r.id}:${r.date}`));
    localStorage.setItem("sika:notified", JSON.stringify(sent));
  } catch {
    // Notifications refusées ou indisponibles : les rappels restent visibles dans l'application.
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  checkDue();
  render();
  cloud.pull();
});

// ---------- Animation d'ouverture ----------

/** Fait remonter le rideau (après ~2 s ou au toucher), puis lance les compteurs. */
function runSplash() {
  const el = document.getElementById("splash");
  if (!el) return;
  if (getComputedStyle(el).display === "none") {
    el.remove();
    return;
  }
  let done = false;
  const leave = () => {
    if (done) return;
    done = true;
    el.classList.add("leave");
    view.classList.remove("enter");
    view.classList.add("reveal");
    setTimeout(() => {
      el.remove();
      countUp(view);
    }, 900);
    setTimeout(() => view.classList.remove("reveal"), 1700);
  };
  el.addEventListener("click", leave);
  setTimeout(leave, 2000);
}

// ---------- Démarrage ----------

applyTheme(themeOf(state.settings));
checkDue();
render();
runSplash();

initCloud({
  getState: () => state,
  applyRemote: (data) => replaceState(data, { fromCloud: true }),
  onChange: () => {
    // Rafraîchit les écrans qui affichent l'état du compte.
    if (/^#\/(plus|compte|reglages)/.test(location.hash)) render();
  },
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
