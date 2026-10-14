import * as calc from "../calc.js";
import { category } from "../data.js";
import { esc, money, num, bigMoney, countUp, toast, icon, catIcon, dueBadge, fmtDate, fmtShort, freqLabel, monthLabel, monthShort, signed, today, $$ } from "../ui.js";
import { openAddSheet, openTransactionSheet } from "../sheets.js";
import { shouldOfferInstall, dismissInstall, openInstallSheet } from "../install.js";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
}

export function shiftMonth(key, delta) {
  const [y, m] = key.split("-").map(Number);
  return calc.monthKey(new Date(y, m - 1 + delta, 1));
}

/** Ligne de paiement programmé (accueil, calendrier, liste des factures). */
export function paymentRow({ rule, date, overdue }, { showFreq = true } = {}) {
  const per = { weekly: "par semaine", monthly: "par mois", bimonthly: "tous les 2 mois", quarterly: "par trimestre", yearly: "par an" }[rule.frequency];
  return `
    <a class="list-row glass" href="#/paiement/${rule.id}">
      ${catIcon(rule.category)}
      <div class="lr-main">
        <div class="lr-title"><b>${esc(rule.note)}</b>${overdue ? `<span class="badge late">En retard</span>` : dueBadge(date)}</div>
        <small>${showFreq ? `${freqLabel(rule.frequency)} · ` : ""}${fmtDate(date)}${rule.variable ? " · montant variable" : ""}</small>
      </div>
      <div class="lr-amount ${rule.type === "income" ? "pos" : ""}">
        <b>${rule.variable ? "≈ " : ""}${num(rule.amount)}</b><small>${per}</small>
      </div>
    </a>`;
}

export function txRow(t) {
  const c = category(t.category);
  return `
    <button class="list-row glass tx" data-tx="${t.id}">
      ${catIcon(t.category)}
      <div class="lr-main">
        <div class="lr-title"><b>${esc(t.note || c.label)}</b>${t.recurringId ? `<span class="rec" title="Paiement programmé">↻</span>` : ""}</div>
        <small>${esc(c.label)} · ${fmtShort(t.date)}</small>
      </div>
      <div class="lr-amount ${t.type === "income" ? "pos" : "neg"}"><b>${signed(t.amount, t.type)}</b></div>
    </button>`;
}

export function bindTxRows(ctx, root) {
  $$("[data-tx]", root).forEach((b) =>
    b.addEventListener("click", () => {
      const tx = ctx.state.transactions.find((t) => t.id === b.dataset.tx);
      if (tx) openTransactionSheet(ctx, tx);
    }),
  );
}

export function home(ctx) {
  const { state } = ctx;
  const now = today();
  const key = ctx.ui.month;
  const isCurrent = key === calc.monthKey(new Date());
  const monthTx = calc.filterByMonth(state.transactions, key);
  const { income, expense, balance } = calc.summarize(monthTx);
  const prev = calc.summarize(calc.filterByMonth(state.transactions, shiftMonth(key, -1)));
  const diff = prev.expense > 0 ? (expense - prev.expense) / prev.expense : null;
  const active = state.recurring.filter((r) => !r.paused);
  const upcoming = calc.upcomingPayments(state.recurring, now, 30);
  const reminders = calc.reminders(state, now);
  const recent = [...state.transactions].sort((a, b) => b.date.localeCompare(a.date) || 0).slice(0, 5);
  const name = state.settings.name?.trim();
  const projected = isCurrent ? balance + calc.upcomingThisMonth(state.recurring, now).reduce((s, i) => s + (i.rule.type === "income" ? i.rule.amount : -i.rule.amount), 0) : null;

  const trend =
    diff === null
      ? `<span class="trend">Aucune dépense en ${monthLabel(shiftMonth(key, -1)).split(" ")[0]} pour comparer</span>`
      : `<span class="trend ${diff <= 0 ? "good" : "bad"}">${icon(diff <= 0 ? "down" : "up")} ${Math.abs(Math.round(diff * 100))} % ${diff <= 0 ? "de moins" : "de plus"} qu'en ${monthLabel(shiftMonth(key, -1)).split(" ")[0]}</span>`;

  const stack = active.slice(0, 3).map((r) => catIcon(r.category, "xs")).join("");

  return {
    html: `
    <header class="top">
      <div class="hello">
        <a class="avatar" href="#/plus" aria-label="Profil">${esc((name || "S")[0].toUpperCase())}</a>
        <div><small>${greeting()} 👋</small><b>${esc(name || "Bienvenue sur Sika")}</b></div>
      </div>
      <a class="icon-btn bell" href="#/rappels" aria-label="Rappels${reminders.length ? ` (${reminders.length})` : ""}">${icon("bell")}${reminders.length ? `<i class="dot"></i>` : ""}</a>
    </header>

    <section class="hero glass">
      <div class="hero-top">
        <span class="eyebrow">Total dépensé</span>
        <label class="pill-select">
          <span>${monthShort(key)}</span>${icon("down")}
          <select data-month aria-label="Choisir le mois">${monthOptions(state, key)}</select>
        </label>
      </div>
      <div class="hero-amount">${bigMoney(expense, "xl")}</div>
      <div class="hero-foot">
        ${trend}
        <a class="stack-info" href="#/paiements">
          <span class="stack">${stack}</span>
          <b>${active.length} paiement${active.length > 1 ? "s" : ""}</b><small>programmé${active.length > 1 ? "s" : ""}</small>
        </a>
      </div>
      <div class="hero-split">
        <div><small>Revenus</small><b class="pos">${money(income)}</b></div>
        <div><small>Reste</small><b class="${balance >= 0 ? "" : "neg"}">${money(balance)}</b></div>
        ${projected !== null ? `<div><small>Prévu fin du mois</small><b class="${projected >= 0 ? "" : "neg"}">${money(projected)}</b></div>` : ""}
      </div>
      <i class="hero-notch" aria-hidden="true"></i>
    </section>

    <nav class="quick" aria-label="Actions rapides">
      <button class="quick-btn glass" data-add><span class="qi" style="--q:#6366f1">${icon("plus")}</span>Ajouter</button>
      <a class="quick-btn glass" href="#/paiements"><span class="qi" style="--q:#10b981">${icon("receipt")}</span>Factures</a>
      <a class="quick-btn glass" href="#/analyses"><span class="qi" style="--q:#f59e0b">${icon("chart")}</span>Analyses</a>
      <button class="quick-btn glass" data-momo><span class="qi" style="--q:#0ea5e9">${icon("phone")}</span>Mobile Money</button>
    </nav>

    ${reminders.length ? `
    <a class="alert glass" href="#/rappels">
      <span class="alert-ico">${icon("bell")}</span>
      <div><b>${reminders.length} paiement${reminders.length > 1 ? "s" : ""} à confirmer</b><small>${esc(reminders.slice(0, 2).map((r) => r.title).join(", "))}${reminders.length > 2 ? "…" : ""}</small></div>
      ${icon("next")}
    </a>` : ""}

    ${shouldOfferInstall() ? `
    <div class="install-banner glass">
      <img src="icons/icon-192.png" alt="" width="40" height="40">
      <div><b>Installez Sika</b><small>Sur votre écran d'accueil, comme une vraie application</small></div>
      <button class="pill" data-install-app>Installer</button>
      <button class="icon-btn sm" data-install-later aria-label="Plus tard">${icon("close")}</button>
    </div>` : ""}

    <section class="block">
      <div class="block-head"><h2>Prochains paiements</h2><a class="pill" href="#/calendrier">Voir tout ${icon("next")}</a></div>
      ${upcoming.length
        ? `<div class="list">${upcoming.slice(0, 4).map((i) => paymentRow(i)).join("")}</div>`
        : `<div class="empty glass"><p>Programmez votre salaire, votre loyer, vos factures CIE / SODECI… pour ne plus rien oublier.</p><button class="btn primary" data-rule>${icon("plus")} Programmer un paiement</button></div>`}
    </section>

    <section class="block">
      <div class="block-head"><h2>Dernières transactions</h2><a class="pill" href="#/transactions">Voir tout ${icon("next")}</a></div>
      ${recent.length
        ? `<div class="list">${recent.map(txRow).join("")}</div>`
        : `<div class="empty glass"><p>Aucune transaction pour l'instant. Touchez <b>+</b> pour noter une dépense ou un revenu.</p></div>`}
    </section>`,
    bind(root) {
      root.querySelector("[data-install-app]")?.addEventListener("click", openInstallSheet);
      root.querySelector("[data-install-later]")?.addEventListener("click", () => {
        dismissInstall();
        ctx.render();
        toast("D'accord ! Vous pourrez installer Sika depuis le menu Plus.");
      });
      root.querySelector("[data-month]").addEventListener("change", (e) => {
        ctx.ui.month = e.target.value;
        ctx.render();
      });
      root.querySelector("[data-add]").addEventListener("click", () => openAddSheet(ctx, "expense"));
      // Sans animation d'ouverture, les montants défilent dès l'affichage.
      if (!document.getElementById("splash")) countUp(root);
      root.querySelector("[data-momo]").addEventListener("click", () => openAddSheet(ctx, "momo"));
      root.querySelector("[data-rule]")?.addEventListener("click", () => openAddSheet(ctx, "rule"));
      bindTxRows(ctx, root);
    },
  };
}

/** Options du sélecteur de mois : 12 derniers mois + mois des transactions. */
export function monthOptions(state, selected) {
  const now = calc.monthKey(new Date());
  const keys = new Set([now]);
  if (selected) keys.add(selected);
  for (let i = 1; i < 12; i++) keys.add(shiftMonth(now, -i));
  for (const t of state.transactions) keys.add(calc.monthKey(t.date));
  return [...keys]
    .sort()
    .reverse()
    .map((k) => `<option value="${k}" ${k === selected ? "selected" : ""}>${monthLabel(k)}</option>`)
    .join("");
}

