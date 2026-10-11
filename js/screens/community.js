// Tontines et dettes / prêts.

import * as calc from "../calc.js";
import * as act from "../actions.js";
import { esc, money, num, cur, icon, bar, bigMoney, fmtDate, fmtShort, initialsIcon, dueBadge, freqLabel, today, toast, $, $$ } from "../ui.js";
import { openTontineSheet, openDebtSheet, openRepaymentSheet } from "../sheets.js";
import { notFound } from "./bills.js";

// ---------- Tontines ----------

export function tontines(ctx) {
  const { state } = ctx;
  const now = today();
  return {
    html: `
    <header class="top">
      <a class="icon-btn" href="#/plus" aria-label="Retour">${icon("back")}</a>
      <h1 class="top-title">Tontines</h1>
      <button class="icon-btn" data-new aria-label="Nouvelle tontine">${icon("plus")}</button>
    </header>
    ${state.tontines.length
      ? `<div class="list">${state.tontines
          .map((t) => {
            const { round, finished } = calc.tontineCurrentRound(t, now);
            const mine = calc.tontineMyRound(t);
            const myPaid = (t.paid?.[round.index] || []).includes(t.myIndex);
            return `
            <a class="goal-card glass" href="#/tontine/${t.id}">
              <div class="goal-top">${initialsIcon(t.name, "#f97316")}<div class="lr-main"><b>${esc(t.name)}</b><small>${num(t.amount)} ${cur()} · ${freqLabel(t.frequency).toLowerCase()} · ${t.members.length} membres</small></div>
                ${finished ? `<span class="badge muted">Terminée</span>` : myPaid ? `<span class="badge ok">Cotisé</span>` : dueBadge(round.date) || `<span class="badge soft">Tour ${round.index + 1}</span>`}</div>
              ${bar((round.index + 1) / t.members.length)}
              <div class="goal-bottom"><span>Cagnotte <b>${money(calc.tontinePot(t))}</b></span><span>${t.received ? "Cagnotte reçue ✅" : `Mon tour : <b>${fmtShort(mine.date)}</b>`}</span></div>
            </a>`;
          })
          .join("")}</div>`
      : `<div class="empty glass"><p>Suivez vos cotisations, l'ordre de passage et la date où vous recevez la cagnotte.</p><button class="btn primary" data-new>${icon("plus")} Créer une tontine</button></div>`}`,
    bind(root) {
      $$("[data-new]", root).forEach((b) => b.addEventListener("click", () => openTontineSheet(ctx)));
    },
  };
}

export function tontineDetail(ctx, id) {
  const { state } = ctx;
  const t = state.tontines.find((x) => x.id === id);
  if (!t) return { html: notFound("Cette tontine n'existe plus."), bind() {} };
  const now = today();
  const schedule = calc.tontineSchedule(t);
  const { round } = calc.tontineCurrentRound(t, now);
  const shown = ctx.ui.tontineRound?.[t.id] ?? round.index;
  const r = schedule[shown];
  const paid = new Set(t.paid?.[shown] || []);
  const mine = calc.tontineMyRound(t);
  const pot = calc.tontinePot(t);
  const myTurnReached = mine.date <= now;
  const myContribs = state.transactions.filter((x) => x.tontineId === t.id && x.category === "tontine").reduce((s, x) => s + x.amount, 0);

  return {
    html: `
    <header class="top">
      <a class="icon-btn" href="#/tontines" aria-label="Retour">${icon("back")}</a>
      <h1 class="top-title caps">Tontine</h1>
      <button class="icon-btn" data-edit aria-label="Modifier">${icon("edit")}</button>
    </header>
    <section class="hero glass detail-hero">
      <div class="hero-top"><span class="badge soft">Tour ${round.index + 1} / ${t.members.length}</span>
        ${!t.received && myTurnReached ? `<button class="pill" data-receive>J'ai reçu la cagnotte ${icon("check")}</button>` : t.received ? `<span class="badge ok">Cagnotte reçue</span>` : ""}</div>
      <div class="detail-id">${initialsIcon(t.name, "#f97316")}<div><h2>${esc(t.name)}</h2><small>${num(t.amount)} ${cur()} ${freqLabel(t.frequency).toLowerCase()} · ${t.members.length} membres</small></div></div>
      <div class="detail-amount">${bigMoney(pot, "xl")}<small class="of">de cagnotte par tour</small></div>
      <i class="hero-notch" aria-hidden="true"></i>
    </section>
    <section class="stats-2">
      <div class="stat glass"><span class="eyebrow">${icon("calendar")} Mon tour</span><b>${fmtDate(mine.date)}</b><small>Tour ${t.myIndex + 1}${myTurnReached ? "" : ` · dans ${calc.daysUntil(now, mine.date)} j`}</small></div>
      <div class="stat glass"><span class="eyebrow">${icon("wallet")} J'ai cotisé</span><b>${money(myContribs)}</b><small>sur ${money(pot)} au total</small></div>
    </section>
    <section class="block">
      <div class="block-head">
        <h2>Cotisations du tour ${shown + 1}</h2>
        <div class="top-actions">
          <button class="icon-btn sm" data-round="-1" ${shown === 0 ? "disabled" : ""} aria-label="Tour précédent">${icon("back")}</button>
          <button class="icon-btn sm" data-round="1" ${shown === schedule.length - 1 ? "disabled" : ""} aria-label="Tour suivant">${icon("next")}</button>
        </div>
      </div>
      <p class="muted">${fmtDate(r.date)} · bénéficiaire : <b>${esc(shown === t.myIndex ? "moi" : r.beneficiary)}</b> · ${paid.size}/${t.members.length} ont cotisé</p>
      ${bar(paid.size / t.members.length, paid.size === t.members.length ? "ok" : "")}
      <div class="list members">
        ${t.members
          .map(
            (m, i) => `
          <label class="list-row glass member">
            ${initialsIcon(i === t.myIndex ? "Moi" : m, i === t.myIndex ? "#4f46e5" : "#94a3b8")}
            <div class="lr-main"><b>${esc(i === t.myIndex ? "Moi" : m)}</b><small>${i === shown ? "Bénéficiaire de ce tour" : `Tour ${i + 1} · ${fmtShort(schedule[i].date)}`}</small></div>
            <input type="checkbox" class="member-check" data-member="${i}" ${paid.has(i) ? "checked" : ""} aria-label="${esc(m)} a cotisé">
          </label>`,
          )
          .join("")}
      </div>
      <p class="muted">Cocher « Moi » enregistre votre cotisation comme dépense.</p>
    </section>
    <button class="link-danger" data-delete>${icon("trash")} Supprimer la tontine</button>`,
    bind(root) {
      $("[data-edit]", root).addEventListener("click", () => openTontineSheet(ctx, t));
      $$("[data-round]", root).forEach((b) =>
        b.addEventListener("click", () => {
          ctx.ui.tontineRound = { ...(ctx.ui.tontineRound || {}), [t.id]: shown + Number(b.dataset.round) };
          ctx.render();
        }),
      );
      $$("[data-member]", root).forEach((c) =>
        c.addEventListener("change", () => {
          act.toggleTontinePaid(state, t, shown, Number(c.dataset.member), { date: today() });
          ctx.commit();
        }),
      );
      $("[data-receive]", root)?.addEventListener("click", () => {
        if (!confirm(`Enregistrer la réception de la cagnotte (${money(pot)}) comme revenu ?`)) return;
        act.receiveTontine(state, t, today());
        ctx.commit();
        toast("Cagnotte enregistrée 🎉");
      });
      $("[data-delete]", root).addEventListener("click", () => {
        if (!confirm(`Supprimer la tontine « ${t.name} » ? Les transactions déjà enregistrées sont conservées.`)) return;
        state.tontines = state.tontines.filter((x) => x !== t);
        ctx.commit();
        ctx.navigate("#/tontines");
      });
    },
  };
}

// ---------- Dettes et prêts ----------

export function debts(ctx) {
  const { state } = ctx;
  const { owedToMe, iOwe } = calc.debtTotals(state.debts);
  const open = state.debts.filter((d) => calc.debtRemaining(d) > 0);
  const closed = state.debts.filter((d) => calc.debtRemaining(d) <= 0);
  const row = (d) => {
    const remaining = calc.debtRemaining(d);
    return `
      <a class="list-row glass" href="#/dette/${d.id}">
        ${initialsIcon(d.person, d.direction === "lent" ? "#7c3aed" : "#64748b")}
        <div class="lr-main"><div class="lr-title"><b>${esc(d.person)}</b>${remaining > 0 && d.due ? dueBadge(d.due) : ""}</div>
          <small>${d.direction === "lent" ? "Vous a emprunté" : "Vous lui devez"} · ${fmtShort(d.date)}${d.note ? ` · ${esc(d.note)}` : ""}</small></div>
        <div class="lr-amount ${remaining <= 0 ? "" : d.direction === "lent" ? "pos" : "neg"}"><b>${remaining <= 0 ? "Soldé" : num(remaining)}</b><small>${remaining <= 0 ? money(d.amount) : `sur ${num(d.amount)}`}</small></div>
      </a>`;
  };
  return {
    html: `
    <header class="top">
      <a class="icon-btn" href="#/plus" aria-label="Retour">${icon("back")}</a>
      <h1 class="top-title">Dettes & prêts</h1>
      <button class="icon-btn" data-new aria-label="Ajouter">${icon("plus")}</button>
    </header>
    <section class="stats-2">
      <div class="stat glass"><span class="eyebrow">On me doit</span><b class="pos">${money(owedToMe)}</b><small>${state.debts.filter((d) => d.direction === "lent" && calc.debtRemaining(d) > 0).length} personne(s)</small></div>
      <div class="stat glass"><span class="eyebrow">Je dois</span><b class="neg">${money(iOwe)}</b><small>${state.debts.filter((d) => d.direction === "borrowed" && calc.debtRemaining(d) > 0).length} personne(s)</small></div>
    </section>
    <section class="block">
      <div class="block-head"><h2>En cours</h2></div>
      ${open.length ? `<div class="list">${open.map(row).join("")}</div>` : `<div class="empty glass"><p>Notez l'argent prêté à un proche ou emprunté, pour ne rien oublier et rester en bons termes.</p><button class="btn primary" data-new>${icon("plus")} Ajouter</button></div>`}
    </section>
    ${closed.length ? `<section class="block"><div class="block-head"><h2>Soldés</h2></div><div class="list">${closed.map(row).join("")}</div></section>` : ""}`,
    bind(root) {
      $$("[data-new]", root).forEach((b) => b.addEventListener("click", () => openDebtSheet(ctx)));
    },
  };
}

export function debtDetail(ctx, id) {
  const { state } = ctx;
  const d = state.debts.find((x) => x.id === id);
  if (!d) return { html: notFound("Introuvable."), bind() {} };
  const remaining = calc.debtRemaining(d);
  const repaid = calc.debtRepaid(d);
  const lent = d.direction === "lent";
  return {
    html: `
    <header class="top">
      <a class="icon-btn" href="#/dettes" aria-label="Retour">${icon("back")}</a>
      <h1 class="top-title caps">${lent ? "Prêt" : "Dette"}</h1>
      <button class="icon-btn" data-edit aria-label="Modifier">${icon("edit")}</button>
    </header>
    <section class="hero glass detail-hero">
      <div class="hero-top">${remaining <= 0 ? `<span class="badge ok">Soldé ✅</span>` : d.due ? dueBadge(d.due) || `<span class="badge soft">Avant le ${fmtShort(d.due)}</span>` : `<span class="badge soft">Sans échéance</span>`}
        ${remaining > 0 ? `<button class="pill" data-repay>${lent ? "Remboursement reçu" : "Rembourser"} ${icon("check")}</button>` : ""}</div>
      <div class="detail-id">${initialsIcon(d.person, lent ? "#7c3aed" : "#64748b")}<div><h2>${esc(d.person)}</h2><small>${lent ? "Vous a emprunté" : "Vous lui devez"} · le ${fmtDate(d.date)}</small></div></div>
      <div class="detail-amount">${bigMoney(remaining, "xl")}<small class="of">reste sur ${money(d.amount)}</small></div>
      ${bar(repaid / d.amount, remaining <= 0 ? "ok" : "")}
      <i class="hero-notch" aria-hidden="true"></i>
    </section>
    ${d.note ? `<p class="muted note-line">📝 ${esc(d.note)}</p>` : ""}
    <section class="block">
      <div class="block-head"><h2>Remboursements</h2></div>
      ${d.repayments.length
        ? `<div class="list">${[...d.repayments].reverse().map((r) => `<div class="list-row glass"><span class="cat-icon sm" style="--c:#16a34a">${icon("check")}</span><div class="lr-main"><b>${fmtDate(r.date)}</b></div><div class="lr-amount"><b>${money(r.amount)}</b></div><button class="icon-btn sm" data-del-rep="${r.id}" aria-label="Supprimer ce remboursement">${icon("close")}</button></div>`).join("")}</div>`
        : `<div class="empty glass"><p>Aucun remboursement pour l'instant.</p></div>`}
    </section>
    <button class="link-danger" data-delete>${icon("trash")} Supprimer</button>`,
    bind(root) {
      $("[data-edit]", root).addEventListener("click", () => openDebtSheet(ctx, d));
      $("[data-repay]", root)?.addEventListener("click", () => openRepaymentSheet(ctx, d));
      $$("[data-del-rep]", root).forEach((b) =>
        b.addEventListener("click", () => {
          if (!confirm("Supprimer ce remboursement ? La transaction associée reste dans l'historique.")) return;
          d.repayments = d.repayments.filter((r) => r.id !== b.dataset.delRep);
          ctx.commit();
        }),
      );
      $("[data-delete]", root).addEventListener("click", () => {
        if (!confirm("Supprimer ? Les transactions déjà enregistrées sont conservées.")) return;
        state.debts = state.debts.filter((x) => x !== d);
        ctx.commit();
        ctx.navigate("#/dettes");
      });
    },
  };
}
