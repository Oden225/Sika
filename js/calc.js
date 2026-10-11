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

/** Ajoute `days` jours à une date ISO. */
export function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Nombre de jours de `from` à `to` (négatif si `to` est passé). */
export function daysUntil(from, to) {
  const a = new Date(from + "T00:00:00");
  const b = new Date(to + "T00:00:00");
  return Math.round((b - a) / 864e5);
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

// ---------- Paiements programmés (récurrents) ----------

const pad2 = (n) => String(n).padStart(2, "0");
const toISO = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
const MONTH_STEP = { monthly: 1, bimonthly: 2, quarterly: 3, yearly: 12 };

/**
 * Date ISO de la k-ième échéance (k = 0 : date de départ). Pour un 31 du mois,
 * l'échéance tombe le dernier jour des mois plus courts (28 ou 29 février…).
 */
export function nthOccurrence(start, frequency, k) {
  const [y, m, d] = start.split("-").map(Number);
  if (frequency === "weekly") {
    const date = new Date(y, m - 1, d + 7 * k);
    return toISO(date.getFullYear(), date.getMonth(), date.getDate());
  }
  const monthIndex = m - 1 + (MONTH_STEP[frequency] || 1) * k;
  const year = y + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return toISO(year, month, Math.min(d, lastDay));
}

/**
 * Échéances d'une règle strictement après `after` (ou depuis le départ si
 * null) et jusqu'à `until` inclus, en respectant la date de fin éventuelle.
 */
export function occurrencesBetween(rule, after, until) {
  const dates = [];
  const limit = rule.end && rule.end < until ? rule.end : until;
  for (let k = 0; k < 5000; k++) {
    const date = nthOccurrence(rule.start, rule.frequency, k);
    if (date > limit) break;
    if (!after || date > after) dates.push(date);
  }
  return dates;
}

/** Prochaine échéance strictement après `after`, ou null si la règle est terminée. */
export function nextOccurrence(rule, after) {
  for (let k = 0; k < 5000; k++) {
    const date = nthOccurrence(rule.start, rule.frequency, k);
    if (rule.end && date > rule.end) return null;
    if (date > after) return date;
  }
  return null;
}

/** Une règle est enregistrée automatiquement sauf si `auto` vaut false. */
export const isAuto = (rule) => rule.auto !== false;

/**
 * Crée les transactions dues jusqu'à `today` pour les règles automatiques et
 * actives. Chaque règle mémorise `lastRun` (dernière échéance traitée), ce qui
 * évite les doublons et ne recrée pas une transaction supprimée à la main.
 */
export function generateRecurring(rules, today) {
  const transactions = [];
  const updated = rules.map((rule) => {
    if (rule.paused || !isAuto(rule)) return rule;
    const dates = occurrencesBetween(rule, rule.lastRun || null, today);
    if (!dates.length) return rule;
    for (const date of dates) {
      transactions.push({
        type: rule.type,
        amount: rule.amount,
        category: rule.category,
        date,
        note: rule.note,
        recurringId: rule.id,
      });
    }
    return { ...rule, lastRun: dates[dates.length - 1] };
  });
  return { transactions, rules: updated };
}

/** Échéances non confirmées (règles « à confirmer ») arrivées jusqu'à `today`. */
export function pendingOccurrences(rule, today) {
  if (rule.paused || isAuto(rule)) return [];
  return occurrencesBetween(rule, rule.lastRun || null, today);
}

/**
 * Échéances à venir et en retard de toutes les règles actives sur `days`
 * jours, triées par date. Les échéances en retard (à confirmer) sont incluses.
 */
export function upcomingPayments(rules, today, days = 30) {
  const until = addDays(today, days);
  const items = [];
  for (const rule of rules) {
    if (rule.paused) continue;
    for (const date of pendingOccurrences(rule, addDays(today, -1))) {
      items.push({ rule, date, daysLeft: daysUntil(today, date), overdue: true });
    }
    // Aujourd'hui inclus pour les règles à confirmer, exclu pour les automatiques (déjà enregistrées).
    const after = isAuto(rule) ? today : addDays(today, -1);
    const from = rule.lastRun && rule.lastRun > after ? rule.lastRun : after;
    for (const date of occurrencesBetween(rule, from, until)) {
      items.push({ rule, date, daysLeft: daysUntil(today, date), overdue: false });
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

/** Montants encore attendus d'ici la fin du mois de `today`. */
export function upcomingThisMonth(rules, today) {
  const [y, m] = today.split("-").map(Number);
  const daysLeft = new Date(y, m, 0).getDate() - Number(today.slice(8));
  return upcomingPayments(rules, today, daysLeft);
}

/** Total payé pour une règle (somme de ses transactions). */
export function totalPaidForRule(transactions, ruleId) {
  return transactions.filter((t) => t.recurringId === ruleId).reduce((s, t) => s + t.amount, 0);
}

// ---------- Revenus irréguliers ----------

/**
 * Revenu mensuel moyen des `n` mois précédant `key` (mois "AAAA-MM", exclu),
 * en ignorant les mois sans aucun revenu. Sert à planifier quand les revenus
 * varient d'un mois à l'autre.
 */
export function averageMonthlyIncome(transactions, key, n = 3) {
  const [y, m] = key.split("-").map(Number);
  const totals = [];
  for (let i = 1; i <= n; i++) {
    const k = monthKey(new Date(y, m - 1 - i, 1));
    const { income } = summarize(filterByMonth(transactions, k));
    if (income > 0) totals.push(income);
  }
  return totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
}

/** Montant suggéré à mettre de côté sur une rentrée d'argent, arrondi à 500 F. */
export function suggestedSaving(amount, percent) {
  return Math.round((amount * percent) / 100 / 500) * 500;
}

// ---------- Mobile Money ----------

/** Frais d'une opération : `rate` en %, plafond `cap` (0 = sans plafond), arrondi au franc. */
export function mobileMoneyFee(amount, { rate = 0, cap = 0 } = {}) {
  const fee = Math.round((amount * rate) / 100);
  return cap > 0 ? Math.min(fee, cap) : fee;
}

// ---------- Dettes et prêts ----------

export function debtRepaid(debt) {
  return (debt.repayments || []).reduce((s, r) => s + r.amount, 0);
}

export function debtRemaining(debt) {
  return Math.max(0, debt.amount - debtRepaid(debt));
}

/** Totaux encore dus : ce qu'on me doit (`owedToMe`) et ce que je dois (`iOwe`). */
export function debtTotals(debts) {
  let owedToMe = 0;
  let iOwe = 0;
  for (const d of debts) {
    if (d.direction === "lent") owedToMe += debtRemaining(d);
    else iOwe += debtRemaining(d);
  }
  return { owedToMe, iOwe };
}

// ---------- Tontine ----------

/** Montant de la cagnotte d'un tour : cotisation × nombre de membres. */
export function tontinePot(t) {
  return t.amount * t.members.length;
}

/** Calendrier des tours : date et bénéficiaire (membres dans l'ordre de passage). */
export function tontineSchedule(t) {
  return t.members.map((member, index) => ({
    index,
    date: nthOccurrence(t.start, t.frequency, index),
    beneficiary: member,
  }));
}

/**
 * Tour en cours à `today` : le prochain tour à venir (aujourd'hui compris),
 * pour lequel on cotise ; le dernier si tous sont passés. `finished` quand le
 * dernier tour est passé et que tout le monde a cotisé.
 */
export function tontineCurrentRound(t, today) {
  const schedule = tontineSchedule(t);
  const upcoming = schedule.find((r) => r.date >= today);
  const current = upcoming ? upcoming.index : schedule.length - 1;
  const last = schedule[schedule.length - 1];
  const finished = last ? last.date < today && (t.paid?.[last.index] || []).length >= t.members.length : false;
  return { round: schedule[current], finished };
}

/** Mon tour (date où je reçois la cagnotte). */
export function tontineMyRound(t) {
  return tontineSchedule(t)[t.myIndex] || null;
}

/** Nombre de membres ayant cotisé pour un tour. */
export function tontinePaidCount(t, round) {
  return (t.paid?.[round] || []).length;
}

// ---------- Rappels ----------

/**
 * Éléments qui demandent une action : paiements à confirmer en retard ou
 * proches (selon le rappel de chaque règle), dettes arrivant à échéance,
 * cotisations de tontine à verser.
 */
export function reminders(state, today) {
  const items = [];
  for (const { rule, date, daysLeft, overdue } of upcomingPayments(state.recurring, today, 31)) {
    if (isAuto(rule)) continue;
    const remind = rule.remindDays ?? 2;
    if (overdue || daysLeft <= remind) {
      items.push({ kind: "bill", id: rule.id, title: rule.note, date, daysLeft, amount: rule.amount, type: rule.type });
    }
  }
  for (const d of state.debts || []) {
    const remaining = debtRemaining(d);
    if (!d.due || remaining <= 0) continue;
    const daysLeft = daysUntil(today, d.due);
    if (daysLeft <= 3) {
      items.push({ kind: "debt", id: d.id, title: d.direction === "lent" ? `${d.person} vous doit` : `Rembourser ${d.person}`, date: d.due, daysLeft, amount: remaining, type: d.direction === "lent" ? "income" : "expense" });
    }
  }
  for (const t of state.tontines || []) {
    const { round, finished } = tontineCurrentRound(t, today);
    if (finished || !round) continue;
    const myPaid = (t.paid?.[round.index] || []).includes(t.myIndex);
    const daysLeft = daysUntil(today, round.date);
    if (!myPaid && daysLeft <= 2) {
      items.push({ kind: "tontine", id: t.id, title: `Cotisation ${t.name}`, date: round.date, daysLeft, amount: t.amount, type: "expense" });
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}
