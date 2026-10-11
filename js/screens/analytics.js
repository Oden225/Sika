import * as calc from "../calc.js";
import { categoriesOf, category, CATEGORIES } from "../data.js";
import { esc, money, num, pct, icon, bar, catIcon, monthLabel, monthShort, readAmount, toast, $, $$ } from "../ui.js";
import { shiftMonth, monthOptions } from "./home.js";

const groupTotal = (txs, group) =>
  txs.filter((t) => t.type === "expense" && category(t.category).group === group).reduce((s, t) => s + t.amount, 0);

export function analytics(ctx) {
  const { state } = ctx;
  const key = ctx.ui.month;
  const monthTx = calc.filterByMonth(state.transactions, key);
  const { income, expense, balance } = calc.summarize(monthTx);
  const cats = calc.expensesByCategory(monthTx);
  const savedToGoals = monthTx.filter((t) => t.category === "epargne").reduce((s, t) => s + t.amount, 0);
  const saved = Math.max(0, balance + savedToGoals);
  const rate = calc.savingsRate(income, expense - savedToGoals);
  const bills = groupTotal(monthTx, "factures");
  const support = groupTotal(monthTx, "soutien");
  const fees = monthTx.filter((t) => t.category === "frais_momo").reduce((s, t) => s + t.amount, 0);
  const avg = calc.averageMonthlyIncome(state.transactions, key, 3);

  // Donut des dépenses
  const R = 52, C = 2 * Math.PI * R;
  let offset = 0;
  const top = cats.slice(0, 6);
  const rest = cats.slice(6).reduce((s, c) => s + c.amount, 0);
  const slices = [...top, ...(rest ? [{ category: "autre_depense", amount: rest, other: true }] : [])];
  const arcs = slices
    .map((s) => {
      const len = (s.amount / expense) * C;
      const el = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${category(s.category).color}" stroke-width="18" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}"><title>${esc(s.other ? "Autres" : category(s.category).label)} : ${num(s.amount)}</title></circle>`;
      offset += len;
      return el;
    })
    .join("");

  // 6 derniers mois
  const keys = Array.from({ length: 6 }, (_, i) => shiftMonth(key, i - 5));
  const series = keys.map((k) => ({ k, ...calc.summarize(calc.filterByMonth(state.transactions, k)) }));
  const max = Math.max(1, ...series.flatMap((d) => [d.income, d.expense]));
  const W = 340, H = 160, gw = (W - 10) / 6, bw = gw * 0.28;
  const bars = series
    .map((d, i) => {
      const x = 10 + i * gw + gw * 0.18;
      const hi = (d.income / max) * (H - 36), he = (d.expense / max) * (H - 36);
      return `<rect x="${x}" y="${H - 20 - hi}" width="${bw}" height="${hi}" rx="4" fill="var(--pos)"><title>Revenus ${num(d.income)}</title></rect>
        <rect x="${x + bw + 3}" y="${H - 20 - he}" width="${bw}" height="${he}" rx="4" fill="var(--accent)"><title>Dépenses ${num(d.expense)}</title></rect>
        <text x="${x + bw + 1}" y="${H - 5}" text-anchor="middle">${esc(monthShort(d.k).split(" ")[0])}</text>`;
    })
    .join("");

  const rule = calc.budgetRule(income);

  return {
    html: `
    <header class="top">
      <a class="icon-btn" href="#/" aria-label="Retour">${icon("back")}</a>
      <h1 class="top-title">Analyses</h1>
      <label class="pill-select"><span>${monthShort(key)}</span>${icon("down")}<select data-month aria-label="Mois">${monthOptions(state, key)}</select></label>
    </header>
    <section class="stats-2">
      <div class="stat glass"><span class="eyebrow">Revenus</span><b class="pos">${money(income)}</b><small>${avg ? `Moyenne 3 mois : ${money(avg)}` : "—"}</small></div>
      <div class="stat glass"><span class="eyebrow">Dépenses</span><b>${money(expense)}</b><small>${!income ? "Taux d'épargne : —" : rate < 0 ? "Dépenses supérieures aux revenus" : `Taux d'épargne : ${pct(rate)}`}</small></div>
      <div class="stat glass"><span class="eyebrow">⚡ Factures</span><b>${money(bills)}</b><small>CIE, SODECI, TV, crédit</small></div>
      <div class="stat glass"><span class="eyebrow">👨‍👩‍👧 Soutien familial</span><b>${money(support)}</b><small>Famille, cérémonies</small></div>
    </section>
    ${fees ? `<div class="alert glass soft"><span class="alert-ico">💸</span><div><b>${money(fees)} de frais Mobile Money</b><small>ce mois-ci${income ? ` · ${pct(fees / income)} de vos revenus` : ""}. Regrouper vos envois réduit les frais.</small></div></div>` : ""}

    <section class="glass card-pad">
      <div class="block-head"><h2>Où part l'argent</h2><a class="pill" href="#/budgets">Budgets ${icon("next")}</a></div>
      ${cats.length
        ? `<div class="donut-wrap">
            <svg class="donut" viewBox="0 0 140 140" role="img" aria-label="Répartition des dépenses"><g transform="rotate(-90 70 70)">${arcs}</g>
              <text x="70" y="66" text-anchor="middle" class="donut-label">Total</text><text x="70" y="84" text-anchor="middle" class="donut-value">${num(expense)}</text></svg>
            <div class="cat-bars">${cats
              .map(({ category: id, amount }) => {
                const limit = state.budgets[id] || 0;
                const ratio = limit ? amount / limit : amount / cats[0].amount;
                const cls = limit ? (ratio > 1 ? "over" : ratio > 0.8 ? "warn" : "") : "";
                return `<div class="cat-bar">${catIcon(id, "xs")}<div class="cb-main"><div class="cb-label"><span>${esc(category(id).label)}</span><b>${num(amount)}${limit ? ` <small>/ ${num(limit)}</small>` : ""}</b></div>${bar(ratio, cls)}</div></div>`;
              })
              .join("")}</div>
          </div>`
        : `<p class="muted">Aucune dépense en ${monthLabel(key)}.</p>`}
    </section>

    <section class="glass card-pad chart">
      <div class="block-head"><h2>6 derniers mois</h2></div>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Revenus et dépenses des 6 derniers mois"><line x1="10" x2="${W}" y1="${H - 20}" y2="${H - 20}" stroke="var(--line)"/>${bars}</svg>
      <div class="legend"><span><b style="background:var(--pos)"></b>Revenus</span><span><b style="background:var(--accent)"></b>Dépenses</span></div>
    </section>

    <section class="glass card-pad">
      <div class="block-head"><h2>Règle 50 / 30 / 20</h2></div>
      ${income > 0
        ? `<p class="muted">Repère : 50 % pour les besoins (loyer, factures, nourriture), 30 % pour le reste, 20 % d'épargne.</p>
           <div class="rule-rows">
             <div><span>Besoins (50 %)</span><b>${money(rule.needs)}</b></div>
             <div><span>Envies / famille (30 %)</span><b>${money(rule.wants)}</b></div>
             <div><span>Épargne (20 %)</span><b>${money(saved)} / ${money(rule.savings)}</b></div>
           </div>
           ${bar(saved / rule.savings, saved >= rule.savings ? "ok" : "")}
           <p class="muted">${saved >= rule.savings ? "Bravo, vous épargnez au moins 20 % ce mois-ci." : `Il manque ${money(rule.savings - saved)} pour atteindre 20 %.`}</p>`
        : `<p class="muted">Ajoutez vos revenus du mois pour voir la répartition.</p>`}
    </section>`,
    bind(root) {
      $("[data-month]", root).addEventListener("change", (e) => {
        ctx.ui.month = e.target.value;
        ctx.render();
      });
    },
  };
}

export function budgets(ctx) {
  const { state } = ctx;
  const key = calc.monthKey(new Date());
  const spent = Object.fromEntries(calc.expensesByCategory(calc.filterByMonth(state.transactions, key)).map((c) => [c.category, c.amount]));
  const skip = new Set(["epargne", "pret_accorde", "remboursement_dette"]);
  return {
    html: `
    <header class="top">
      <a class="icon-btn" href="#/analyses" aria-label="Retour">${icon("back")}</a>
      <h1 class="top-title">Budgets du mois</h1>
      <span class="top-spacer"></span>
    </header>
    <p class="muted pad-x">Fixez un plafond mensuel par catégorie. La barre passe à l'orange à 80 %, au rouge en cas de dépassement.</p>
    <form class="list budget-form">
      ${categoriesOf("expense")
        .filter((c) => !skip.has(c.id))
        .map((c) => {
          const limit = state.budgets[c.id] || 0;
          const s = spent[c.id] || 0;
          return `<div class="list-row glass budget-row">
            ${catIcon(c.id)}
            <div class="lr-main"><b>${esc(c.label)}</b><small>${s ? `${money(s)} dépensés` : "Rien ce mois-ci"}</small>${limit ? bar(s / limit, s > limit ? "over" : s > limit * 0.8 ? "warn" : "") : ""}</div>
            <input class="budget-input" name="${c.id}" inputmode="numeric" placeholder="Plafond" value="${limit ? num(limit) : ""}" aria-label="Plafond ${esc(c.label)}">
          </div>`;
        })
        .join("")}
      <div class="sticky-save"><button class="btn primary block">Enregistrer les budgets</button></div>
    </form>`,
    bind(root) {
      const form = $(".budget-form", root);
      $$(".budget-input", form).forEach((i) =>
        i.addEventListener("input", () => {
          const d = i.value.replace(/\D/g, "");
          i.value = d ? num(Number(d)) : "";
        }),
      );
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const next = {};
        for (const i of $$(".budget-input", form)) {
          const v = readAmount(i.value);
          if (v > 0) next[i.name] = v;
        }
        state.budgets = next;
        ctx.commit();
        toast("Budgets enregistrés");
      });
    },
  };
}

