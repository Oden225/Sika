import * as calc from "../calc.js";
import * as act from "../actions.js";
import { category, BILL_TEMPLATES } from "../data.js";
import { esc, money, num, cur, icon, catIcon, dueBadge, fmtDate, freqLabel, today, toggle, toast, signed, $, $$ } from "../ui.js";
import { openAddSheet, openPaySheet, openRuleSheet, ruleForm } from "../sheets.js";
import { openSheet } from "../ui.js";
import { paymentRow } from "./home.js";

export function bills(ctx) {
  const { state } = ctx;
  const now = today();
  const rows = (list) =>
    list
      .map((rule) => {
        const next = rule.paused ? null : act.occurrenceToPay(rule, now) || null;
        if (!next) {
          return `<a class="list-row glass ${rule.paused ? "paused" : ""}" href="#/paiement/${rule.id}">${catIcon(rule.category)}
            <div class="lr-main"><div class="lr-title"><b>${esc(rule.note)}</b><span class="badge muted">${rule.paused ? "En pause" : "Terminé"}</span></div><small>${freqLabel(rule.frequency)}</small></div>
            <div class="lr-amount"><b>${num(rule.amount)}</b><small>${cur()}</small></div></a>`;
        }
        return paymentRow({ rule, date: next, overdue: next < now });
      })
      .join("");
  const incomes = state.recurring.filter((r) => r.type === "income");
  const expenses = state.recurring.filter((r) => r.type === "expense");
  const monthly = (list) =>
    list.filter((r) => !r.paused).reduce((s, r) => s + r.amount * ({ weekly: 52 / 12, monthly: 1, bimonthly: 1 / 2, quarterly: 1 / 3, yearly: 1 / 12 }[r.frequency] || 1), 0);

  return {
    html: `
    <header class="top">
      <a class="icon-btn" href="#/" aria-label="Retour">${icon("back")}</a>
      <h1 class="top-title">Paiements programmés</h1>
      <button class="icon-btn" data-add aria-label="Programmer">${icon("plus")}</button>
    </header>
    <section class="stats-2">
      <div class="stat glass"><span class="eyebrow">${icon("receipt")} Charges / mois</span><b>${money(monthly(expenses))}</b><small>${expenses.length} facture(s) et abonnement(s)</small></div>
      <div class="stat glass"><span class="eyebrow">${icon("wallet")} Revenus fixes / mois</span><b class="pos">${money(monthly(incomes))}</b><small>${incomes.length} revenu(s) programmé(s)</small></div>
    </section>
    <section class="block">
      <div class="block-head"><h2>Ajouter rapidement</h2></div>
      <div class="templates big">
        ${BILL_TEMPLATES.map((tpl, i) => `<button class="tpl glass" data-tpl="${i}">${catIcon(tpl.category, "sm")}<span>${esc(tpl.note)}</span></button>`).join("")}
      </div>
    </section>
    <section class="block">
      <div class="block-head"><h2>Factures & abonnements</h2></div>
      ${expenses.length ? `<div class="list">${rows(expenses)}</div>` : `<div class="empty glass"><p>Loyer, CIE, SODECI, Canal+, internet, scolarité… ajoutez-les pour être prévenu à temps.</p></div>`}
    </section>
    <section class="block">
      <div class="block-head"><h2>Revenus programmés</h2></div>
      ${incomes.length ? `<div class="list">${rows(incomes)}</div>` : `<div class="empty glass"><p>Ajoutez votre salaire de fin de mois pour voir ce qu'il vous restera.</p></div>`}
    </section>`,
    bind(root) {
      $("[data-add]", root).addEventListener("click", () => openRuleSheet(ctx));
      $$("[data-tpl]", root).forEach((b) =>
        b.addEventListener("click", () =>
          openSheet("Programmer un paiement", `<div class="add-pane"></div>`, (r) => ruleForm(ctx, $(".add-pane", r), null, BILL_TEMPLATES[b.dataset.tpl])),
        ),
      );
    },
  };
}

export function billDetail(ctx, id) {
  const { state } = ctx;
  const rule = state.recurring.find((r) => r.id === id);
  if (!rule) return { html: notFound("Ce paiement n'existe plus."), bind() {} };
  const now = today();
  const c = category(rule.category);
  const next = rule.paused ? null : act.occurrenceToPay(rule, now);
  const history = state.transactions.filter((t) => t.recurringId === rule.id).sort((a, b) => b.date.localeCompare(a.date));
  const total = history.reduce((s, t) => s + t.amount, 0);
  const isIncome = rule.type === "income";
  const goal = rule.goalId ? state.goals.find((g) => g.id === rule.goalId) : null;
  const per = { weekly: "/ semaine", monthly: "/ mois", bimonthly: "/ 2 mois", quarterly: "/ trimestre", yearly: "/ an" }[rule.frequency];
  const inLabel = next ? relative(next, now) : "";

  return {
    html: `
    <header class="top">
      <a class="icon-btn" href="#/paiements" aria-label="Retour">${icon("back")}</a>
      <h1 class="top-title caps">${isIncome ? "Revenu programmé" : "Paiement programmé"}</h1>
      <button class="icon-btn" data-edit aria-label="Modifier">${icon("edit")}</button>
    </header>

    <section class="hero glass detail-hero">
      <div class="hero-top">
        ${rule.paused ? `<span class="badge muted">En pause</span>` : next ? dueBadge(next) || `<span class="badge soft">${esc(inLabel)}</span>` : `<span class="badge muted">Terminé</span>`}
        ${next ? `<button class="pill" data-pay>${isIncome ? "Confirmer" : "Payer"} ${icon("arrowUpRight")}</button>` : ""}
      </div>
      <div class="detail-id">
        ${catIcon(rule.category, "xl")}
        <div><h2>${esc(rule.note)}</h2><small>${esc(c.label)} · ${freqLabel(rule.frequency)}${rule.variable ? " · variable" : ""}</small>
          ${goal ? `<a class="goal-link" href="#/objectif/${goal.id}">${esc(goal.icon || "🎯")} Vers l'objectif « ${esc(goal.name)} » ${icon("next")}</a>` : ""}</div>
      </div>
      <div class="detail-amount">
        ${rule.variable ? `<span class="approx">≈</span>` : ""}<span class="big-money xl"><span class="n">${num(rule.amount)}</span><span class="cur">${cur()} ${per}</span></span>
      </div>
      <i class="hero-notch" aria-hidden="true"></i>
    </section>

    <section class="stats-2">
      <div class="stat glass"><span class="eyebrow">${icon("calendar")} Prochaine échéance</span><b>${next ? fmtDate(next) : "—"}</b><small>${next ? esc(inLabel) : rule.paused ? "En pause" : "Terminé"}</small></div>
      <div class="stat glass"><span class="eyebrow">${icon("refresh")} Fréquence</span><b>${freqLabel(rule.frequency)}</b><small>Depuis le ${fmtDate(rule.start)}</small></div>
      <div class="stat glass"><span class="eyebrow">${icon("clock")} Total ${isIncome ? "reçu" : "payé"}</span><b>${money(total)}</b><small>${history.length} fois</small></div>
      <div class="stat glass"><span class="eyebrow">${icon("tag")} Catégorie</span><b>${esc(c.label.split(" (")[0])}</b><small>${rule.end ? `Jusqu'au ${fmtDate(rule.end)}` : "Sans date de fin"}</small></div>
    </section>

    <section class="toggles glass-list">
      <div class="toggle-row glass">
        <span class="t-ico">${icon("bell")}</span>
        <div><b>Rappel</b><small>${rule.remindDays ? `Me prévenir ${rule.remindDays} jour${rule.remindDays > 1 ? "s" : ""} avant` : "Me prévenir le jour même"}</small></div>
        <select class="mini-select" data-remind aria-label="Délai du rappel">${[0, 1, 2, 3, 5, 7].map((d) => `<option value="${d}" ${d === (rule.remindDays ?? 2) ? "selected" : ""}>${d === 0 ? "Jour J" : `J-${d}`}</option>`).join("")}</select>
      </div>
      <div class="toggle-row glass">
        <span class="t-ico">${icon("refresh")}</span>
        <div><b>Enregistrement auto</b><small>${rule.variable ? "Indisponible pour un montant variable" : "Ajouter la transaction à chaque échéance"}</small></div>
        ${rule.variable ? `<label class="switch"><input type="checkbox" disabled aria-label="Enregistrement auto"><span></span></label>` : toggle("auto", rule.auto !== false, "Enregistrement auto")}
      </div>
    </section>

    <section class="block">
      <div class="block-head"><h2>Historique</h2></div>
      ${history.length
        ? `<div class="list">${history.slice(0, 12).map((t) => `<div class="list-row glass"><span class="cat-icon sm" style="--c:${c.color}">${icon("check")}</span><div class="lr-main"><b>${fmtDate(t.date)}</b><small>${esc(t.note || "")}</small></div><div class="lr-amount ${isIncome ? "pos" : "neg"}"><b>${signed(t.amount, t.type)}</b></div></div>`).join("")}</div>`
        : `<div class="empty glass"><p>Aucun paiement enregistré pour l'instant.</p></div>`}
    </section>

    <div class="bottom-actions">
      <button class="btn orange" data-pause>${rule.paused ? `Reprendre ${icon("play")}` : `Pause ${icon("pause")}`}</button>
      <button class="btn red" data-delete>Arrêter ${icon("close")}</button>
    </div>`,
    bind(root) {
      $("[data-edit]", root).addEventListener("click", () => openRuleSheet(ctx, rule));
      $("[data-pay]", root)?.addEventListener("click", () => openPaySheet(ctx, rule));
      $("[data-remind]", root).addEventListener("change", (e) => {
        rule.remindDays = Number(e.target.value);
        ctx.commit();
      });
      $("[name=auto]", root)?.addEventListener("change", (e) => {
        rule.auto = e.target.checked;
        if (rule.auto) {
          // Activation : les échéances en attente sont ajoutées tout de suite.
          const n = act.applyRecurring(state, today());
          if (n) toast(`${n} transaction(s) ajoutée(s)`);
        }
        ctx.commit();
      });
      $("[data-pause]", root).addEventListener("click", () => {
        if (rule.paused) {
          rule.paused = false;
          // Pas de rattrapage des échéances tombées pendant la pause.
          const missed = calc.occurrencesBetween(rule, rule.lastRun, calc.addDays(today(), -1));
          if (missed.length) rule.lastRun = missed.at(-1);
          act.applyRecurring(state, today());
          toast("Paiement repris");
        } else {
          rule.paused = true;
          toast("Paiement en pause");
        }
        ctx.commit();
      });
      $("[data-delete]", root).addEventListener("click", () => {
        if (!confirm(`Arrêter « ${rule.note} » ? Les paiements déjà enregistrés sont conservés.`)) return;
        state.recurring = state.recurring.filter((r) => r !== rule);
        ctx.commit();
        ctx.navigate("#/paiements");
        toast("Paiement arrêté");
      });
    },
  };
}

function relative(date, now) {
  const d = calc.daysUntil(now, date);
  if (d < 0) return `En retard de ${-d} jour${d < -1 ? "s" : ""}`;
  if (d === 0) return "Aujourd'hui";
  if (d === 1) return "Demain";
  if (d < 31) return `Dans ${d} jours`;
  const months = Math.round(d / 30);
  return months <= 1 ? "Le mois prochain" : `Dans ${months} mois`;
}

export function notFound(msg) {
  return `<header class="top"><a class="icon-btn" href="#/" aria-label="Retour">${icon("back")}</a><h1 class="top-title">Introuvable</h1><span></span></header>
    <div class="empty glass"><p>${esc(msg)}</p><a class="btn primary" href="#/">Retour à l'accueil</a></div>`;
}

