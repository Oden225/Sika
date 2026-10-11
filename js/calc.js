// Fonctions de calcul pures (sans accès au DOM ni au stockage),
// testées dans tests/calc.test.mjs.

/** Clé "AAAA-MM" d'une date ISO ou d'un objet Date. */
export function monthKey(date) {
  const d = typeof date === "string" ? new Date(date + "T00:00:00") : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Nombre de mois entiers restants entre `from` et `to` (minimum 1). */
export function monthsBetween(from, to) {
  const a = typeof from === "string" ? new Date(from + "T00:00:00") : from;
  const b = typeof to === "string" ? new Date(to + "T00:00:00") : to;
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  return Math.max(1, months);
}

/** Total des revenus, des dépenses et solde pour une liste de transactions. */
export function summarize(transactions) {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, balance: income - expense };
}

/** Transactions appartenant au mois "AAAA-MM". */
export function filterByMonth(transactions, key) {
  return transactions.filter((t) => monthKey(t.date) === key);
}

/** Dépenses regroupées par catégorie, triées de la plus grosse à la plus petite. */
export function expensesByCategory(transactions) {
  const totals = new Map();
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    totals.set(t.category, (totals.get(t.category) || 0) + t.amount);
  }
  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

/** Taux d'épargne du mois : part des revenus non dépensée (0 si aucun revenu). */
export function savingsRate(income, expense) {
  if (income <= 0) return 0;
  return (income - expense) / income;
}

/**
 * Versement mensuel nécessaire pour atteindre `target` en `months` mois,
 * en partant de `saved`, avec un rendement annuel `annualRate` (ex. 0.035).
 */
export function monthlyContribution(target, saved, months, annualRate = 0) {
  const n = Math.max(1, months);
  const i = annualRate / 12;
  if (i === 0) return Math.max(0, (target - saved) / n);
  const growth = Math.pow(1 + i, n);
  const remaining = target - saved * growth;
  if (remaining <= 0) return 0;
  return (remaining * i) / (growth - 1);
}

/**
 * Projection mois par mois d'une épargne : capital de départ, versement
 * mensuel et rendement annuel. Renvoie une valeur par année (index 0 = départ).
 */
export function projectSavings(initial, monthly, annualRate, years) {
  const i = annualRate / 12;
  const points = [{ year: 0, balance: initial, contributed: initial }];
  let balance = initial;
  let contributed = initial;
  for (let m = 1; m <= years * 12; m++) {
    balance = balance * (1 + i) + monthly;
    contributed += monthly;
    if (m % 12 === 0) points.push({ year: m / 12, balance, contributed });
  }
  return points;
}

/** Répartition indicative 50/30/20 (besoins / envies / épargne) d'un revenu. */
export function budgetRule(income) {
  return { needs: income * 0.5, wants: income * 0.3, savings: income * 0.2 };
}

/** Progression d'un objectif entre 0 et 1. */
export function goalProgress(goal) {
  if (goal.target <= 0) return 1;
  return Math.min(1, Math.max(0, goal.saved / goal.target));
}
