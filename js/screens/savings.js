import * as calc from "../calc.js";
import * as act from "../actions.js";
import { esc, money, num, cur, pct, icon, bar, bigMoney, fmtDate, fmtShort, today, toast, toggle, $, $$ } from "../ui.js";
import { openGoalSheet, openGoalMoveSheet, openGoalAutoSheet, suggestedGoalAmount } from "../sheets.js";
import { notFound } from "./bills.js";

function goalPlan(goal, now) {
  const done = goal.saved >= goal.target;
  const late = !done && goal.deadline < now;
  const months = calc.monthsBetween(now, goal.deadline);
  const monthly = done ? 0 : calc.monthlyContribution(goal.target, goal.saved, months, goal.rate || 0);
  return { done, late, months, monthly, progress: calc.goalProgress(goal) };
}

export function savings(ctx) {
  const { state } = ctx;
  const now = today();
  const key = calc.monthKey(new Date());
  const totalSaved = state.goals.reduce((s, g) => s + g.saved, 0);
  const needMonthly = state.goals.reduce((s, g) => s + goalPlan(g, now).monthly, 0);
  const avgIncome = calc.averageMonthlyIncome(state.transactions, key, 3);
  const thisMonth = calc.summarize(calc.filterByMonth(state.transactions, key));
  const savedThisMonth = calc.filterByMonth(state.transactions, key).filter((t) => t.category === "epargne").reduce((s, t) => s + t.amount, 0);
  const share = avgIncome > 0 ? needMonthly / avgIncome : null;
  const p = state.settings.savePercent;

  return {
    html: `
    <header class="top">
      <span class="top-spacer"></span>
      <h1 class="top-title">Épargne</h1>
      <button class="icon-btn" data-new aria-label="Nouvel objectif">${icon("plus")}</button>
    </header>

    <section class="hero glass">
      <div class="hero-top"><span class="eyebrow">Épargne totale</span><span class="badge soft">${state.goals.length} objectif${state.goals.length > 1 ? "s" : ""}</span></div>
      <div class="hero-amount">${bigMoney(totalSaved, "xl")}</div>
      <div class="hero-split">
        <div><small>À épargner / mois</small><b>${money(needMonthly)}</b></div>
        <div><small>Épargné ce mois</small><b class="pos">${money(savedThisMonth)}</b></div>
      </div>
      ${share !== null ? `<p class="hero-note">${share <= 0.2 ? "✅" : share <= 0.35 ? "⚠️" : "🔴"} Vos objectifs demandent <b>${pct(share)}</b> de votre revenu moyen (${money(avgIncome)} / mois sur les 3 derniers mois).${share > 0.35 ? " Pensez à repousser une date limite ou réduire un montant." : ""}</p>` : `<p class="hero-note">Ajoutez vos revenus pendant quelques semaines : Sika calculera votre revenu moyen pour vérifier que vos objectifs sont réalistes.</p>`}
      <i class="hero-notch" aria-hidden="true"></i>
    </section>

    <section class="rule-card glass">
      <div class="rule-head">
        <span class="t-ico">🐷</span>
        <div><b>Épargner à chaque rentrée d'argent</b><small>Idéal si vos revenus sont irréguliers : à chaque revenu ajouté, Sika propose de mettre ce pourcentage de côté.</small></div>
      </div>
      <div class="pct-picker" role="radiogroup" aria-label="Pourcentage à épargner">
        ${[0, 5, 10, 15, 20, 30].map((v) => `<label><input type="radio" name="pct" value="${v}" ${v === p ? "checked" : ""}><span>${v === 0 ? "Non" : `${v} %`}</span></label>`).join("")}
      </div>
      ${thisMonth.income > 0 && p > 0 ? `<small class="muted">Ce mois-ci : ${money(thisMonth.income)} de revenus → objectif ${money((thisMonth.income * p) / 100)} mis de côté (fait : ${money(savedThisMonth)}).</small>` : ""}
    </section>

    <section class="block">
      <div class="block-head"><h2>Mes objectifs</h2><a class="pill" href="#/simulateur">Simulateur ${icon("next")}</a></div>
      ${state.goals.length
        ? `<div class="goal-list">${state.goals.map((g) => goalCard(g, now, act.goalRule(state, g.id))).join("")}</div>`
        : `<div class="empty glass"><p>Commencez par un <b>fonds d'urgence</b> (3 à 6 mois de dépenses), puis vos projets : terrain, rentrée scolaire, commerce…</p><button class="btn primary" data-new>${icon("plus")} Créer un objectif</button></div>`}
    </section>`,
    bind(root) {
      $$("[data-new]", root).forEach((b) => b.addEventListener("click", () => openGoalSheet(ctx)));
      $$("[name=pct]", root).forEach((r) =>
        r.addEventListener("change", () => {
          state.settings.savePercent = Number(r.value);
          ctx.commit();
          toast(r.value === "0" ? "Suggestion d'épargne désactivée" : `On vous proposera d'épargner ${r.value} % de chaque revenu`);
        }),
      );
    },
  };
}

const PER = { weekly: "semaine", monthly: "mois" };

function goalCard(g, now, rule) {
  const plan = goalPlan(g, now);
  const badge = plan.done ? `<span class="badge ok">Atteint 🎉</span>` : plan.late ? `<span class="badge late">Échéance dépassée</span>` : `<span class="badge soft">${plan.months} mois</span>`;
  return `
    <a class="goal-card glass" href="#/objectif/${g.id}">
      <div class="goal-top"><span class="goal-emoji">${esc(g.icon || "🎯")}</span><div class="lr-main"><b>${esc(g.name)}</b><small>Avant le ${fmtDate(g.deadline)}</small></div>${badge}</div>
      ${bar(plan.progress, plan.done ? "ok" : "")}
      <div class="goal-bottom"><span><b>${money(g.saved)}</b> / ${money(g.target)}</span><span>${plan.done ? "" : rule && !rule.paused ? `🔁 <b>${money(rule.amount)}</b> / ${PER[rule.frequency] || "mois"}` : `<b>${money(plan.monthly)}</b> / mois`}</span></div>
    </a>`;
}

export function goalDetail(ctx, id) {
  const { state } = ctx;
  const goal = state.goals.find((g) => g.id === id);
  if (!goal) return { html: notFound("Cet objectif n'existe plus."), bind() {} };
  const now = today();
  const plan = goalPlan(goal, now);
  const history = state.transactions.filter((t) => t.goalId === goal.id).sort((a, b) => b.date.localeCompare(a.date));
  const weekly = plan.monthly / (52 / 12);
  const daily = plan.monthly / 30;
  const rule = act.goalRule(state, goal.id);

  return {
    html: `
    <header class="top">
      <a class="icon-btn" href="#/epargne" aria-label="Retour">${icon("back")}</a>
      <h1 class="top-title caps">Objectif</h1>
      <button class="icon-btn" data-edit aria-label="Modifier">${icon("edit")}</button>
    </header>
    <section class="hero glass detail-hero">
      <div class="hero-top">${plan.done ? `<span class="badge ok">Atteint 🎉</span>` : plan.late ? `<span class="badge late">Échéance dépassée</span>` : `<span class="badge soft">${plan.months} mois restants</span>`}<button class="pill" data-add>Épargner ${icon("plus")}</button></div>
      <div class="detail-id"><span class="goal-emoji xl">${esc(goal.icon || "🎯")}</span><div><h2>${esc(goal.name)}</h2><small>Avant le ${fmtDate(goal.deadline)}${goal.rate ? ` · rendement ${(goal.rate * 100).toFixed(1)} %/an` : ""}</small></div></div>
      <div class="detail-amount">${bigMoney(goal.saved, "xl")}<small class="of">sur ${money(goal.target)}</small></div>
      ${bar(plan.progress, plan.done ? "ok" : "")}
      <i class="hero-notch" aria-hidden="true"></i>
    </section>
    <section class="stats-2">
      <div class="stat glass"><span class="eyebrow">${icon("calendar")} Par mois</span><b>${plan.done ? "—" : money(plan.monthly)}</b><small>pour finir à temps</small></div>
      <div class="stat glass"><span class="eyebrow">${icon("clock")} Par semaine</span><b>${plan.done ? "—" : money(weekly)}</b><small>soit ${plan.done ? "—" : money(daily)} / jour</small></div>
      <div class="stat glass"><span class="eyebrow">${icon("target")} Reste à épargner</span><b>${money(Math.max(0, goal.target - goal.saved))}</b><small>${pct(plan.progress)} atteint</small></div>
      <div class="stat glass"><span class="eyebrow">${icon("list")} Versements</span><b>${history.filter((t) => t.type === "expense").length}</b><small>enregistrés</small></div>
    </section>
    ${autoCard(goal, rule, plan, now)}
    <section class="block">
      <div class="block-head"><h2>Historique</h2></div>
      ${history.length
        ? `<div class="list">${history.map((t) => `<div class="list-row glass"><span class="cat-icon sm" style="--c:${t.type === "expense" ? "#14b8a6" : "#94a3b8"}">${t.type === "expense" ? "🐷" : "↩️"}</span><div class="lr-main"><b>${t.type === "expense" ? "Versement" : "Retrait"}</b><small>${fmtDate(t.date)}</small></div><div class="lr-amount ${t.type === "expense" ? "pos" : "neg"}"><b>${t.type === "expense" ? "+" : "−"}${money(t.amount)}</b></div></div>`).join("")}</div>`
        : `<div class="empty glass"><p>Aucun versement pour l'instant.</p></div>`}
    </section>
    <div class="bottom-actions">
      <button class="btn orange" data-withdraw>Retirer</button>
      <button class="btn primary" data-add2>Épargner ${icon("plus")}</button>
    </div>
    <button class="link-danger" data-delete>${icon("trash")} Supprimer l'objectif</button>`,
    bind(root) {
      $("[data-edit]", root).addEventListener("click", () => openGoalSheet(ctx, goal));
      $("[data-add]", root).addEventListener("click", () => openGoalMoveSheet(ctx, goal, 1));
      $("[data-add2]", root).addEventListener("click", () => openGoalMoveSheet(ctx, goal, 1));
      $("[data-withdraw]", root).addEventListener("click", () => openGoalMoveSheet(ctx, goal, -1));
      root.querySelectorAll("[data-auto]").forEach((b) => b.addEventListener("click", () => openGoalAutoSheet(ctx, goal)));
      $("[name=autoOn]", root)?.addEventListener("change", (e) => {
        if (e.target.checked) {
          // Reprise : pas de rattrapage des échéances tombées pendant la pause.
          rule.paused = false;
          rule.pausedReason = undefined;
          const missed = calc.occurrencesBetween(rule, rule.lastRun, calc.addDays(today(), -1));
          if (missed.length) rule.lastRun = missed.at(-1);
          act.applyRecurring(state, today());
          toast("Versement automatique repris");
        } else {
          rule.paused = true;
          toast("Versement automatique en pause");
        }
        ctx.commit();
      });
      $("[data-delete]", root).addEventListener("click", () => {
        if (!confirm(`Supprimer l'objectif « ${goal.name} » ?${rule ? " Son versement automatique sera aussi arrêté." : ""} Les transactions déjà enregistrées sont conservées.`)) return;
        state.goals = state.goals.filter((g) => g !== goal);
        state.recurring = state.recurring.filter((r) => r.goalId !== goal.id);
        ctx.commit();
        ctx.navigate("#/epargne");
      });
    },
  };
}

export function simulator(ctx) {
  const v = ctx.ui.sim;
  return {
    html: `
    <header class="top">
      <a class="icon-btn" href="#/epargne" aria-label="Retour">${icon("back")}</a>
      <h1 class="top-title">Simulateur</h1>
      <span class="top-spacer"></span>
    </header>
    <section class="glass card-pad">
      <form class="form sim-form">
        <div class="row-2">
          <label class="field"><span>Capital de départ</span><input name="initial" inputmode="numeric" value="${num(v.initial)}"></label>
          <label class="field"><span>Par mois</span><input name="monthly" inputmode="numeric" value="${num(v.monthly)}"></label>
        </div>
        <div class="row-2">
          <label class="field"><span>Rendement / an (%)</span><input name="rate" type="number" min="0" max="30" step="0.1" value="${v.rate}"></label>
          <label class="field"><span>Durée (années)</span><input name="years" type="number" min="1" max="40" value="${v.years}"></label>
        </div>
      </form>
      <p class="muted">Repères : un compte épargne bancaire rapporte souvent autour de 3,5 % par an ; une tontine ne rapporte pas d'intérêts mais force la discipline.</p>
    </section>
    <div class="sim-out"></div>`,
    bind(root) {
      const form = $(".sim-form", root);
      const out = $(".sim-out", root);
      const draw = () => {
        const parse = (x) => Number(String(x).replace(/\D/g, "")) || 0;
        v.initial = parse(form.initial.value);
        v.monthly = parse(form.monthly.value);
        v.rate = Number(form.rate.value) || 0;
        v.years = Math.min(40, Math.max(1, Math.round(Number(form.years.value) || 1)));
        const pts = calc.projectSavings(v.initial, v.monthly, v.rate / 100, v.years);
        const last = pts.at(-1);
        const W = 340, H = 170, pad = 20;
        const max = Math.max(1, last.balance);
        const x = (i) => pad + (i / v.years) * (W - 2 * pad);
        const y = (val) => H - 22 - (val / max) * (H - 40);
        const line = (k) => pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join("");
        const area = `${line("balance")}L${x(v.years)},${H - 22}L${x(0)},${H - 22}Z`;
        const step = Math.ceil(v.years / 5);
        out.innerHTML = `
          <section class="stats-2">
            <div class="stat glass"><span class="eyebrow">Capital final</span><b class="pos">${money(last.balance)}</b><small>après ${v.years} an${v.years > 1 ? "s" : ""}</small></div>
            <div class="stat glass"><span class="eyebrow">Intérêts gagnés</span><b>${money(last.balance - last.contributed)}</b><small>sur ${money(last.contributed)} versés</small></div>
          </section>
          <section class="glass card-pad chart">
            <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution de l'épargne">
              <defs><linearGradient id="g1" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".28"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
              <line x1="${pad}" x2="${W - pad}" y1="${H - 22}" y2="${H - 22}" stroke="var(--line)"/>
              <path d="${area}" fill="url(#g1)"/>
              <path d="${line("contributed")}" fill="none" stroke="var(--muted)" stroke-dasharray="4 4" stroke-width="2"/>
              <path d="${line("balance")}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"/>
              ${pts.filter((p) => p.year % step === 0).map((p) => `<text x="${x(p.year)}" y="${H - 6}" text-anchor="middle">${p.year} an${p.year > 1 ? "s" : ""}</text>`).join("")}
            </svg>
            <div class="legend"><span><b style="background:var(--accent)"></b>Avec intérêts</span><span><b style="background:var(--muted)"></b>Sommes versées</span></div>
          </section>`;
      };
      form.addEventListener("input", (e) => {
        if (e.target.name === "initial" || e.target.name === "monthly") {
          const d = e.target.value.replace(/\D/g, "");
          e.target.value = d ? num(Number(d)) : "";
        }
        draw();
      });
      draw();
    },
  };
}


/** Carte « Versement automatique » de la fiche objectif. */
function autoCard(goal, rule, plan, now) {
  if (!rule) {
    if (plan.done) return "";
    return `
    <button class="auto-cta glass" data-auto>
      <span class="t-ico">🔁</span>
      <span class="lr-main"><b>Programmer un versement automatique</b><small>Par exemple ${money(suggestedGoalAmount(goal))} chaque mois, mis de côté le jour du salaire</small></span>
      ${icon("next", "chev")}
    </button>`;
  }
  const next = rule.paused ? null : calc.nextOccurrence(rule, rule.lastRun && rule.lastRun >= now ? rule.lastRun : calc.addDays(now, -1));
  const status = rule.paused
    ? rule.pausedReason === "goal_reached" ? "En pause : objectif atteint 🎉" : "En pause"
    : `${money(rule.amount)} par ${PER[rule.frequency] || "mois"}${next ? ` · prochain le ${fmtShort(next)}` : ""}${rule.auto === false ? " · à confirmer" : ""}`;
  return `
    <section class="toggles">
      <div class="toggle-row glass">
        <span class="t-ico">🔁</span>
        <div><b>Versement automatique</b><small>${status}</small></div>
        ${toggle("autoOn", !rule.paused, "Versement automatique actif")}
      </div>
      <button class="link-muted" data-auto>${icon("edit")} Modifier le montant ou la date</button>
    </section>`;
}
