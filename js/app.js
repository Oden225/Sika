import * as calc from "./calc.js";
import { load, save, normalize, uid, DEFAULT_CATEGORIES } from "./store.js";

let state = load();
let currentMonth = calc.monthKey(new Date());

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------- Utilitaires d'affichage ----------

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const numberFmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const money = (n) => `${numberFmt.format(Math.round(n))} ${escapeHtml(state.settings.currency)}`;
const pct = (n) => `${(n * 100).toFixed(0)} %`;
const isoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = () => isoDate(new Date());

function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function shiftMonth(key, delta) {
  const [y, m] = key.split("-").map(Number);
  return calc.monthKey(new Date(y, m - 1 + delta, 1));
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2200);
}

function commit() {
  save(state);
  render();
}

function bar(ratio, extraClass = "") {
  const w = Math.max(0, Math.min(1, ratio)) * 100;
  return `<div class="bar ${extraClass}"><i style="width:${w}%"></i></div>`;
}

// ---------- Onglets ----------

function showTab(name) {
  $$(".tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
  $$(".tab-panel").forEach((p) => (p.hidden = p.id !== `tab-${name}`));
  try { localStorage.setItem("sika:tab", name); } catch {}
}

$$(".tabs button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));

// ---------- Tableau de bord ----------

function renderDashboard() {
  $("#month-label").textContent = monthLabel(currentMonth);
  const monthTx = calc.filterByMonth(state.transactions, currentMonth);
  const { income, expense, balance } = calc.summarize(monthTx);
  // Les versements vers les objectifs (catégorie « Épargne ») sont de l'épargne, pas une dépense.
  const toGoals = monthTx.filter((t) => t.type === "expense" && t.category === "Épargne").reduce((s, t) => s + t.amount, 0);
  const saved = Math.max(0, balance + toGoals);
  const rate = calc.savingsRate(income, expense - toGoals);

  $("#kpi-income").innerHTML = money(income);
  $("#kpi-expense").innerHTML = money(expense);
  const bal = $("#kpi-balance");
  bal.innerHTML = money(balance);
  bal.className = balance >= 0 ? "pos" : "neg";
  $("#kpi-rate").textContent = income > 0 ? pct(rate) : "—";

  // Dépenses par catégorie
  const cats = calc.expensesByCategory(monthTx);
  $("#chart-categories").innerHTML = cats.length
    ? cats
        .map(({ category, amount }) => {
          const limit = Number(state.budgets[category]) || 0;
          const ratio = limit ? amount / limit : amount / cats[0].amount;
          const cls = limit ? (ratio > 1 ? "over" : ratio > 0.8 ? "warn" : "") : "";
          const right = limit ? `${money(amount)} / ${money(limit)}` : money(amount);
          return `<div class="bar-row"><div class="label"><span>${escapeHtml(category)}</span><span>${right}</span></div>${bar(ratio, cls)}</div>`;
        })
        .join("")
    : `<p class="empty">Aucune dépense ce mois-ci.</p>`;

  renderMonthsChart();
  renderUpcoming(balance);

  // Règle 50/30/20
  const rule = calc.budgetRule(income);
  $("#rule-503020").innerHTML = income > 0
    ? `
      <div class="bar-row"><div class="label"><span>Besoins (50 %)</span><span>${money(rule.needs)}</span></div></div>
      <div class="bar-row"><div class="label"><span>Envies (30 %)</span><span>${money(rule.wants)}</span></div></div>
      <div class="bar-row"><div class="label"><span>Épargne (objectif 20 %)</span><span>${money(saved)} / ${money(rule.savings)}</span></div>${bar(saved / rule.savings)}</div>
      <p class="muted">${saved >= rule.savings ? "Bravo, vous atteignez l'objectif de 20 % d'épargne." : `Il manque ${money(rule.savings - saved)} pour épargner 20 % ce mois-ci.`}</p>`
    : `<p class="empty">Ajoutez vos revenus du mois pour voir la répartition.</p>`;

  // Objectifs
  $("#dashboard-goals").innerHTML = state.goals.length
    ? state.goals
        .map((g) => {
          const p = calc.goalProgress(g);
          return `<div class="bar-row"><div class="label"><span>${escapeHtml(g.name)}</span><span>${pct(p)}</span></div>${bar(p)}</div>`;
        })
        .join("")
    : `<p class="empty">Aucun objectif. Créez-en un dans l'onglet « Objectifs ».</p>`;
}

function renderMonthsChart() {
  const keys = Array.from({ length: 6 }, (_, i) => shiftMonth(currentMonth, i - 5));
  const data = keys.map((k) => ({ k, ...calc.summarize(calc.filterByMonth(state.transactions, k)) }));
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  const W = 360, H = 170, pad = 22, groupW = (W - pad) / 6, bw = groupW * 0.32;

  const bars = data
    .map((d, i) => {
      const x = pad + i * groupW + groupW * 0.15;
      const hi = (d.income / max) * (H - 40);
      const he = (d.expense / max) * (H - 40);
      const [, m] = d.k.split("-").map(Number);
      const lbl = new Date(2000, m - 1, 1).toLocaleDateString("fr-FR", { month: "short" });
      return `
        <rect x="${x}" y="${H - 20 - hi}" width="${bw}" height="${hi}" rx="2" fill="var(--pos)"><title>Revenus : ${numberFmt.format(d.income)}</title></rect>
        <rect x="${x + bw + 2}" y="${H - 20 - he}" width="${bw}" height="${he}" rx="2" fill="var(--neg)"><title>Dépenses : ${numberFmt.format(d.expense)}</title></rect>
        <text x="${x + bw}" y="${H - 5}" text-anchor="middle">${escapeHtml(lbl)}</text>`;
    })
    .join("");

  $("#chart-months").innerHTML = `
    <div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Revenus et dépenses des 6 derniers mois">
      <line x1="${pad}" x2="${W}" y1="${H - 20}" y2="${H - 20}" stroke="var(--border)"/>${bars}
    </svg></div>
    <div class="legend"><span><i style="background:var(--pos)"></i>Revenus</span><span><i style="background:var(--neg)"></i>Dépenses</span></div>`;
}

function renderUpcoming(balance) {
  const box = $("#upcoming");
  const upcoming = currentMonth === calc.monthKey(new Date()) ? calc.upcomingThisMonth(state.recurring, today()) : [];
  box.hidden = !upcoming.length;
  if (!upcoming.length) return;
  const net = upcoming.reduce((s, r) => s + (r.type === "income" ? r.amount : -r.amount), 0);
  const projected = balance + net;
  box.innerHTML = `
    <div class="upcoming-head">
      <h2>À venir d'ici la fin du mois</h2>
      <span>Reste prévu : <strong class="${projected >= 0 ? "pos" : "neg"}">${money(projected)}</strong></span>
    </div>
    <ul class="upcoming-list">
      ${upcoming
        .map(
          (r) => `<li><span>${new Date(r.date + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} · ${escapeHtml(r.note)}</span>
          <span class="${r.type === "income" ? "pos" : "neg"}">${r.type === "income" ? "+" : "−"}${money(r.amount)}</span></li>`,
        )
        .join("")}
    </ul>`;
}

$$("[data-month-step]").forEach((b) =>
  b.addEventListener("click", () => {
    currentMonth = shiftMonth(currentMonth, Number(b.dataset.monthStep));
    renderDashboard();
  }),
);

// ---------- Transactions ----------

const txForm = $("#tx-form");

function fillCategorySelect(form) {
  form.category.innerHTML = DEFAULT_CATEGORIES[form.type.value]
    .map((c) => `<option>${escapeHtml(c)}</option>`)
    .join("");
}

txForm.type.addEventListener("change", () => fillCategorySelect(txForm));
txForm.date.value = today();
fillCategorySelect(txForm);

txForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const amount = Number(txForm.amount.value);
  if (!(amount > 0)) return toast("Montant invalide");
  state.transactions.push({
    id: uid(),
    type: txForm.type.value,
    amount,
    category: txForm.category.value,
    date: txForm.date.value,
    note: txForm.note.value.trim(),
  });
  txForm.amount.value = "";
  txForm.note.value = "";
  txForm.amount.focus();
  commit();
  toast("Transaction ajoutée");
});

function renderTransactions() {
  const filter = $("#tx-filter");
  const months = [...new Set([currentMonth, ...state.transactions.map((t) => calc.monthKey(t.date))])].sort().reverse();
  const selected = filter.value || currentMonth;
  filter.innerHTML =
    `<option value="all">Tous les mois</option>` +
    months.map((k) => `<option value="${k}">${monthLabel(k)}</option>`).join("");
  filter.value = months.includes(selected) || selected === "all" ? selected : currentMonth;

  const list = (filter.value === "all" ? state.transactions : calc.filterByMonth(state.transactions, filter.value))
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  $("#tx-list").innerHTML = list.length
    ? list
        .map(
          (t) => `
      <div class="tx-row">
        <span class="date">${new Date(t.date + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</span>
        <span>${escapeHtml(t.note || t.category)}${t.recurringId ? `<span class="rec-icon" title="Transaction récurrente">↻</span>` : ""}<span class="cat">${escapeHtml(t.category)}</span></span>
        <span class="amount ${t.type === "income" ? "pos" : "neg"}">${t.type === "income" ? "+" : "−"}${money(t.amount)}</span>
        <button class="link" data-del-tx="${t.id}" aria-label="Supprimer">✕</button>
      </div>`,
        )
        .join("")
    : `<p class="empty">Aucune transaction.</p>`;
}

$("#tx-filter").addEventListener("change", renderTransactions);
$("#tx-list").addEventListener("click", (e) => {
  const id = e.target.dataset.delTx;
  if (!id || !confirm("Supprimer cette transaction ?")) return;
  state.transactions = state.transactions.filter((t) => t.id !== id);
  commit();
});

// ---------- Transactions récurrentes ----------

const recForm = $("#rec-form");
const FREQ_LABELS = { weekly: "chaque semaine", monthly: "chaque mois", yearly: "chaque année" };
const shortDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

recForm.type.addEventListener("change", () => fillCategorySelect(recForm));
recForm.start.value = today();
fillCategorySelect(recForm);

/** Ajoute les transactions récurrentes arrivées à échéance. Renvoie le nombre créé. */
function applyRecurring() {
  const { transactions, rules } = calc.generateRecurring(state.recurring, today());
  state.recurring = rules;
  for (const t of transactions) state.transactions.push({ id: uid(), ...t });
  return transactions.length;
}

recForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const amount = Number(recForm.amount.value);
  if (!(amount > 0)) return toast("Montant invalide");
  const end = recForm.end.value || null;
  if (end && end < recForm.start.value) return toast("La date de fin précède la première échéance");

  const rule = {
    id: uid(),
    type: recForm.type.value,
    amount,
    category: recForm.category.value,
    frequency: recForm.frequency.value,
    start: recForm.start.value,
    end,
    note: recForm.note.value.trim() || recForm.category.value,
    lastRun: null,
  };

  // Première échéance dans le passé : proposer de rattraper les échéances manquées.
  const yesterday = isoDate(new Date(Date.now() - 864e5));
  const past = calc.occurrencesBetween(rule, null, yesterday);
  if (past.length && !confirm(`${past.length} échéance(s) sont déjà passées depuis le ${shortDate(rule.start)}. Les ajouter à l'historique ?`)) {
    rule.lastRun = past[past.length - 1];
  }

  state.recurring.push(rule);
  const created = applyRecurring();
  recForm.amount.value = "";
  recForm.note.value = "";
  recForm.end.value = "";
  commit();
  toast(created ? `Programmée — ${created} transaction(s) ajoutée(s)` : "Transaction programmée");
});

function renderRecurring() {
  const now = today();
  $("#rec-list").innerHTML = state.recurring.length
    ? state.recurring
        .map((r) => {
          const next = calc.nextOccurrence(r, now);
          const status = r.paused ? "En pause" : next ? `Prochaine : ${shortDate(next)}` : "Terminée";
          return `
      <div class="tx-row ${r.paused ? "paused" : ""}">
        <span class="date">${FREQ_LABELS[r.frequency]}</span>
        <span>${escapeHtml(r.note)}<span class="cat">${escapeHtml(r.category)} · ${status}</span></span>
        <span class="amount ${r.type === "income" ? "pos" : "neg"}">${r.type === "income" ? "+" : "−"}${money(r.amount)}</span>
        <span>
          <button class="link" data-rec-action="toggle" data-id="${r.id}">${r.paused ? "Reprendre" : "Pause"}</button>
          <button class="link" data-rec-action="delete" data-id="${r.id}" aria-label="Supprimer" title="Supprimer">✕</button>
        </span>
      </div>`;
        })
        .join("")
    : `<p class="empty">Aucune transaction récurrente.</p>`;
}

$("#rec-list").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-rec-action]");
  if (!btn) return;
  const rule = state.recurring.find((r) => r.id === btn.dataset.id);
  if (!rule) return;
  if (btn.dataset.recAction === "delete") {
    if (!confirm(`Arrêter « ${rule.note} » ? Les transactions déjà enregistrées sont conservées.`)) return;
    state.recurring = state.recurring.filter((r) => r !== rule);
  } else if (rule.paused) {
    // À la reprise, on ne rattrape pas les échéances tombées pendant la pause.
    rule.paused = false;
    const missed = calc.occurrencesBetween(rule, rule.lastRun, isoDate(new Date(Date.now() - 864e5)));
    if (missed.length) rule.lastRun = missed[missed.length - 1];
    applyRecurring();
  } else {
    rule.paused = true;
  }
  commit();
});

// ---------- Budgets ----------

function renderBudgets() {
  const form = $("#budget-form");
  const spent = Object.fromEntries(
    calc.expensesByCategory(calc.filterByMonth(state.transactions, calc.monthKey(new Date()))).map((c) => [c.category, c.amount]),
  );
  form.innerHTML =
    DEFAULT_CATEGORIES.expense
      .map((c) => {
        const limit = state.budgets[c] ?? "";
        const s = spent[c] || 0;
        const hint = s ? `${money(s)} dépensés ce mois` : "";
        return `<label>${escapeHtml(c)}
          <input type="number" min="0" step="any" name="${escapeHtml(c)}" value="${limit}" placeholder="Aucun plafond">
          <small>${hint}</small>
          ${limit ? bar(s / limit, s > limit ? "over" : s > limit * 0.8 ? "warn" : "") : ""}
        </label>`;
      })
      .join("") + `<div><button type="submit" class="primary">Enregistrer les plafonds</button></div>`;
}

$("#budget-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const budgets = {};
  for (const input of $$("input", e.target)) {
    const v = Number(input.value);
    if (input.value !== "" && v > 0) budgets[input.name] = v;
  }
  state.budgets = budgets;
  commit();
  toast("Plafonds enregistrés");
});

// ---------- Objectifs d'épargne ----------

const goalForm = $("#goal-form");
{
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  goalForm.deadline.value = isoDate(d);
}

goalForm.addEventListener("submit", (e) => {
  e.preventDefault();
  state.goals.push({
    id: uid(),
    name: goalForm.name.value.trim(),
    target: Number(goalForm.target.value),
    saved: Number(goalForm.saved.value) || 0,
    deadline: goalForm.deadline.value,
    rate: (Number(goalForm.rate.value) || 0) / 100,
    created: today(),
  });
  goalForm.name.value = "";
  goalForm.target.value = "";
  goalForm.saved.value = "0";
  commit();
  toast("Objectif créé");
});

function renderGoals() {
  const now = today();
  $("#goal-list").innerHTML = state.goals.length
    ? state.goals
        .map((g) => {
          const p = calc.goalProgress(g);
          const done = g.saved >= g.target;
          const late = !done && g.deadline < now;
          const months = calc.monthsBetween(now, g.deadline);
          const monthly = calc.monthlyContribution(g.target, g.saved, months, g.rate);
          const badge = done
            ? `<span class="badge">Atteint 🎉</span>`
            : late
              ? `<span class="badge late">Échéance dépassée</span>`
              : `<span class="badge">${months} mois restants</span>`;
          return `
        <div class="card goal">
          <div class="goal-head"><h2>${escapeHtml(g.name)}</h2>${badge}</div>
          ${bar(p)}
          <div class="goal-stats">
            <div><span>Épargné</span>${money(g.saved)} (${pct(p)})</div>
            <div><span>Objectif</span>${money(g.target)}</div>
            <div><span>Échéance</span>${new Date(g.deadline + "T00:00:00").toLocaleDateString("fr-FR")}</div>
            <div><span>À mettre de côté</span>${done ? "—" : `<strong>${money(monthly)}</strong> / mois`}</div>
          </div>
          ${g.rate ? `<p class="muted">Calcul avec un rendement de ${(g.rate * 100).toFixed(1)} % par an.</p>` : ""}
          <div class="goal-actions">
            <input type="number" min="0" step="any" placeholder="Montant" data-amount-for="${g.id}">
            <button data-goal-action="add" data-id="${g.id}" class="primary">Verser</button>
            <button data-goal-action="withdraw" data-id="${g.id}">Retirer</button>
            <label class="muted"><input type="checkbox" data-record-for="${g.id}" checked style="width:auto"> Enregistrer comme dépense « Épargne »</label>
            <button data-goal-action="delete" data-id="${g.id}" class="link">Supprimer</button>
          </div>
        </div>`;
        })
        .join("")
    : `<div class="card"><p class="empty">Aucun objectif pour l'instant. Commencez par un fonds d'urgence de 3 à 6 mois de dépenses.</p></div>`;
}

$("#goal-list").addEventListener("click", (e) => {
  const { goalAction, id } = e.target.dataset;
  if (!goalAction) return;
  const goal = state.goals.find((g) => g.id === id);
  if (!goal) return;

  if (goalAction === "delete") {
    if (!confirm(`Supprimer l'objectif « ${goal.name} » ?`)) return;
    state.goals = state.goals.filter((g) => g.id !== id);
    return commit();
  }

  const amount = Number($(`[data-amount-for="${id}"]`).value);
  if (!(amount > 0)) return toast("Indiquez un montant");
  const record = $(`[data-record-for="${id}"]`).checked;

  if (goalAction === "add") {
    goal.saved += amount;
    if (record) {
      state.transactions.push({ id: uid(), type: "expense", amount, category: "Épargne", date: today(), note: `Versement : ${goal.name}` });
    }
    toast(goal.saved >= goal.target ? "Objectif atteint, félicitations !" : "Versement enregistré");
  } else {
    goal.saved = Math.max(0, goal.saved - amount);
    if (record) {
      state.transactions.push({ id: uid(), type: "income", amount, category: "Autre revenu", date: today(), note: `Retrait : ${goal.name}` });
    }
    toast("Retrait enregistré");
  }
  commit();
});

// ---------- Simulateur ----------

const simForm = $("#sim-form");

function renderSimulator() {
  const initial = Number(simForm.initial.value) || 0;
  const monthly = Number(simForm.monthly.value) || 0;
  const rate = (Number(simForm.rate.value) || 0) / 100;
  const years = Math.min(50, Math.max(1, Math.round(Number(simForm.years.value) || 1)));
  const pts = calc.projectSavings(initial, monthly, rate, years);
  const last = pts[pts.length - 1];

  const W = 360, H = 180, pad = 22;
  const max = Math.max(1, last.balance);
  const x = (i) => pad + (i / years) * (W - 2 * pad);
  const y = (v) => H - 20 - (v / max) * (H - 40);
  const line = (key) => pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join("");
  const step = Math.ceil(years / 6);
  const labels = pts
    .filter((p) => p.year % step === 0)
    .map((p) => `<text x="${x(p.year)}" y="${H - 5}" text-anchor="middle">${p.year} an${p.year > 1 ? "s" : ""}</text>`)
    .join("");

  $("#sim-result").innerHTML = `
    <div class="sim-summary">
      <div class="kpi"><span>Capital final</span><strong class="pos">${money(last.balance)}</strong></div>
      <div class="kpi"><span>Total versé</span><strong>${money(last.contributed)}</strong></div>
      <div class="kpi"><span>Intérêts gagnés</span><strong>${money(last.balance - last.contributed)}</strong></div>
    </div>
    <div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution de l'épargne">
      <line x1="${pad}" x2="${W - pad}" y1="${H - 20}" y2="${H - 20}" stroke="var(--border)"/>
      <path d="${line("contributed")}" fill="none" stroke="var(--muted)" stroke-dasharray="4 3" stroke-width="2"/>
      <path d="${line("balance")}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>
      ${labels}
    </svg></div>
    <div class="legend"><span><i style="background:var(--accent)"></i>Capital avec intérêts</span><span><i style="background:var(--muted)"></i>Sommes versées</span></div>`;
}

simForm.addEventListener("input", renderSimulator);
simForm.addEventListener("submit", (e) => e.preventDefault());

// ---------- Réglages, export / import ----------

const settingsForm = $("#settings-form");
settingsForm.addEventListener("submit", (e) => {
  e.preventDefault();
  state.settings.currency = settingsForm.currency.value.trim() || "FCFA";
  commit();
  toast("Réglages enregistrés");
});

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

$("#export-btn").addEventListener("click", () => {
  download(`sika-sauvegarde-${today()}.json`, JSON.stringify(state, null, 2), "application/json");
});

$("#export-csv-btn").addEventListener("click", () => {
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const rows = [["date", "type", "categorie", "montant", "description"].join(";")];
  for (const t of [...state.transactions].sort((a, b) => a.date.localeCompare(b.date))) {
    rows.push([t.date, t.type === "income" ? "revenu" : "depense", q(t.category), t.amount, q(t.note || "")].join(";"));
  }
  download(`sika-transactions-${today()}.csv`, "﻿" + rows.join("\n"), "text/csv");
});

$("#import-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = normalize(JSON.parse(await file.text()));
    if (!confirm(`Remplacer vos données par ${data.transactions.length} transactions et ${data.goals.length} objectifs ?`)) return;
    state = data;
    commit();
    toast("Données importées");
  } catch {
    toast("Fichier invalide");
  } finally {
    e.target.value = "";
  }
});

$("#reset-btn").addEventListener("click", () => {
  if (!confirm("Effacer toutes vos données ? Cette action est irréversible.")) return;
  state = normalize({});
  commit();
  toast("Données effacées");
});

// ---------- Rendu global ----------

function render() {
  settingsForm.currency.value = state.settings.currency;
  renderDashboard();
  renderTransactions();
  renderRecurring();
  renderBudgets();
  renderGoals();
  renderSimulator();
}

if (applyRecurring()) save(state);
render();

// L'application peut rester ouverte plusieurs jours : on vérifie les échéances au retour.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && applyRecurring()) commit();
});

try {
  const saved = localStorage.getItem("sika:tab");
  if (saved && $(`#tab-${saved}`)) showTab(saved);
} catch {}
