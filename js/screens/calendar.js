import * as calc from "../calc.js";
import { category } from "../data.js";
import { esc, num, cur, icon, catIcon, initialsIcon, fmtLong, monthLabel, today, signed, $$ } from "../ui.js";
import { openAddSheet } from "../sheets.js";
import { shiftMonth, bindTxRows } from "./home.js";

const KIND_COLOR = { income: "var(--pos)", bill: "var(--accent)", tontine: "var(--orange)", debt: "var(--neg)", done: "var(--muted)" };

/** Tous les événements d'un mois : échéances programmées, tontines, dettes, transactions passées. */
function monthEvents(state, key) {
  const [y, m] = key.split("-").map(Number);
  const first = `${key}-01`;
  const last = `${key}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
  const now = today();
  const events = [];

  for (const rule of state.recurring) {
    if (rule.paused) continue;
    for (const date of calc.occurrencesBetween(rule, calc.addDays(first, -1), last)) {
      // Échéances passées déjà traitées : elles apparaissent via leurs transactions.
      if (date < now && rule.lastRun && date <= rule.lastRun) continue;
      if (date < now && calc.isAuto(rule)) continue;
      events.push({
        date,
        kind: rule.type === "income" ? "income" : "bill",
        title: rule.note,
        sub: `${rule.variable ? "Montant variable" : category(rule.category).label}${date < now ? " · en retard" : ""}`,
        amount: rule.amount,
        type: rule.type,
        icon: catIcon(rule.category),
        href: `#/paiement/${rule.id}`,
      });
    }
  }
  for (const t of state.tontines) {
    for (const r of calc.tontineSchedule(t)) {
      if (r.date < first || r.date > last) continue;
      const mine = r.index === t.myIndex;
      events.push({
        date: r.date,
        kind: "tontine",
        title: mine ? `Je reçois la cagnotte · ${t.name}` : `Cotisation ${t.name}`,
        sub: `Tour ${r.index + 1} · bénéficiaire : ${r.index === t.myIndex ? "moi" : r.beneficiary}`,
        amount: mine ? calc.tontinePot(t) : t.amount,
        type: mine ? "income" : "expense",
        icon: catIcon("tontine"),
        href: `#/tontine/${t.id}`,
      });
    }
  }
  for (const d of state.debts) {
    if (!d.due || d.due < first || d.due > last || calc.debtRemaining(d) <= 0) continue;
    events.push({
      date: d.due,
      kind: "debt",
      title: d.direction === "lent" ? `${d.person} doit rembourser` : `Rembourser ${d.person}`,
      sub: "Échéance de remboursement",
      amount: calc.debtRemaining(d),
      type: d.direction === "lent" ? "income" : "expense",
      icon: initialsIcon(d.person, d.direction === "lent" ? "#7c3aed" : "#64748b"),
      href: `#/dette/${d.id}`,
    });
  }
  for (const t of calc.filterByMonth(state.transactions, key)) {
    if (t.date > now) continue;
    events.push({ date: t.date, kind: "done", tx: t });
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
}

export function calendar(ctx) {
  const { state } = ctx;
  const key = ctx.ui.calMonth;
  const now = today();
  const selected = ctx.ui.calDay?.startsWith(key) ? ctx.ui.calDay : null;
  const events = monthEvents(state, key);
  const byDay = Map.groupBy ? Map.groupBy(events, (e) => e.date) : groupBy(events);
  const [y, m] = key.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7; // semaine commençant le lundi
  const scheduled = events.filter((e) => e.kind !== "done");

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(`<span class="day out"></span>`);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${key}-${String(d).padStart(2, "0")}`;
    const evs = (byDay.get(iso) || []).filter((e) => e.kind !== "done" || iso === now);
    const kinds = [...new Set(evs.map((e) => e.kind))].slice(0, 3);
    cells.push(`
      <button class="day ${iso === now ? "today" : ""} ${iso === selected ? "sel" : ""} ${iso < now ? "past" : ""}" data-day="${iso}" aria-label="${fmtLong(iso)}${evs.length ? `, ${evs.length} élément(s)` : ""}">
        <span>${d}</span>
        <i class="dots">${kinds.map((k) => `<b style="background:${KIND_COLOR[k]}"></b>`).join("")}</i>
      </button>`);
  }

  // Liste : le jour choisi, sinon d'aujourd'hui (ou du début du mois) à la fin du mois.
  const from = selected || (key === calc.monthKey(new Date()) ? now : `${key}-01`);
  // Sans jour choisi, les échéances en retard (non réglées) restent visibles.
  const overdue = (d) => d < from && byDay.get(d).some((e) => e.kind !== "done");
  const listDays = [...byDay.keys()].filter((d) => (selected ? d === selected : d >= from || overdue(d))).sort();
  const timeline = listDays
    .map((d) => {
      const evs = byDay.get(d).filter((e) => e.kind !== "done" || d === selected || d === now);
      if (!evs.length) return "";
      const label = d === now ? "Aujourd'hui" : `${evs.length} élément${evs.length > 1 ? "s" : ""}`;
      return `
        <div class="tl-day">
          <div class="tl-head"><h3>${fmtLong(d)}</h3><span>${label}</span></div>
          ${evs.map((e) => (e.kind === "done" ? doneRow(e.tx) : eventRow(e))).join("")}
        </div>`;
    })
    .join("");

  return {
    html: `
    <header class="top">
      <a class="icon-btn" href="#/" aria-label="Retour">${icon("back")}</a>
      <h1 class="top-title">Calendrier</h1>
      <div class="top-actions">
        <button class="icon-btn" data-step="-1" aria-label="Mois précédent">${icon("back")}</button>
        <button class="icon-btn" data-step="1" aria-label="Mois suivant">${icon("next")}</button>
      </div>
    </header>
    <div class="cal-sub">
      <h2>${selected ? fmtLong(selected) : monthLabel(key)}</h2>
      <small>${scheduled.length} échéance${scheduled.length > 1 ? "s" : ""} ce mois</small>
    </div>
    <section class="cal glass">
      <div class="cal-week">${["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => `<span>${d}</span>`).join("")}</div>
      <div class="cal-grid">${cells.join("")}</div>
      <div class="cal-legend">
        <span><b style="background:var(--accent)"></b>Factures</span>
        <span><b style="background:var(--pos)"></b>Revenus</span>
        <span><b style="background:var(--orange)"></b>Tontine</span>
        <span><b style="background:var(--neg)"></b>Dettes</span>
      </div>
    </section>
    <section class="timeline">
      ${timeline || `<div class="empty glass"><p>${selected ? "Rien de prévu ce jour-là." : "Rien de prévu d'ici la fin du mois."}</p></div>`}
    </section>
    <button class="fab" data-add aria-label="Programmer un paiement">${icon("plus")}</button>`,
    bind(root) {
      $$("[data-step]", root).forEach((b) =>
        b.addEventListener("click", () => {
          ctx.ui.calMonth = shiftMonth(ctx.ui.calMonth, Number(b.dataset.step));
          ctx.ui.calDay = null;
          ctx.render();
        }),
      );
      $$("[data-day]", root).forEach((b) =>
        b.addEventListener("click", () => {
          ctx.ui.calDay = ctx.ui.calDay === b.dataset.day ? null : b.dataset.day;
          ctx.render();
        }),
      );
      root.querySelector("[data-add]").addEventListener("click", () => openAddSheet(ctx, "rule"));
      bindTxRows(ctx, root);
    },
  };
}

function eventRow(e) {
  return `
    <a class="tl-row" href="${e.href}" style="--k:${KIND_COLOR[e.kind]}">
      <i class="tl-dot" aria-hidden="true"></i>
      <span class="list-row glass">
        ${e.icon}
        <span class="lr-main"><span class="lr-title"><b>${esc(e.title)}</b></span><small>${esc(e.sub)}</small></span>
        <span class="lr-amount ${e.type === "income" ? "pos" : ""}"><b>${num(e.amount)}</b><small>${cur()}</small></span>
      </span>
    </a>`;
}

function doneRow(t) {
  const c = category(t.category);
  return `
    <div class="tl-row done" style="--k:var(--muted)">
      <i class="tl-dot" aria-hidden="true"></i>
      <button class="list-row glass" data-tx="${t.id}">
        ${catIcon(t.category)}
        <span class="lr-main"><span class="lr-title"><b>${esc(t.note || c.label)}</b></span><small>${esc(c.label)} · fait</small></span>
        <span class="lr-amount ${t.type === "income" ? "pos" : "neg"}"><b>${signed(t.amount, t.type)}</b></span>
      </button>
    </div>`;
}

function groupBy(list) {
  const map = new Map();
  for (const e of list) map.set(e.date, [...(map.get(e.date) || []), e]);
  return map;
}
