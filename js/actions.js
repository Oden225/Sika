// Modifications de l'état utilisées par plusieurs écrans. Chaque fonction
// modifie `state` ; l'appelant enregistre ensuite avec commit().

import * as calc from "./calc.js";
import { uid } from "./store.js";

export function addTransaction(state, tx) {
  const t = { id: uid(), note: "", ...tx };
  state.transactions.push(t);
  return t;
}

/** Ajoute les transactions programmées arrivées à échéance. Renvoie le nombre créé. */
export function applyRecurring(state, today) {
  const { transactions, rules } = calc.generateRecurring(state.recurring, today);
  state.recurring = rules;
  for (const t of transactions) addTransaction(state, t);
  return transactions.length;
}

/** Échéance à régler en priorité : la plus ancienne en attente, sinon la prochaine. */
export function occurrenceToPay(rule, today) {
  const pending = calc.pendingOccurrences({ ...rule, auto: false, paused: false }, today);
  return pending[0] || calc.nextOccurrence(rule, rule.lastRun && rule.lastRun > today ? rule.lastRun : today);
}

/**
 * Confirme le paiement d'une échéance : crée la transaction et marque
 * l'échéance comme traitée. Pour un montant variable, le dernier montant payé
 * devient l'estimation des prochaines échéances.
 */
export function payRule(state, rule, { amount, date, occurrence, note }) {
  addTransaction(state, {
    type: rule.type,
    amount,
    category: rule.category,
    date,
    note: note || rule.note,
    recurringId: rule.id,
  });
  if (!rule.lastRun || occurrence > rule.lastRun) rule.lastRun = occurrence;
  if (rule.variable) rule.amount = amount;
}

/** Passe une échéance sans paiement. */
export function skipOccurrence(rule, occurrence) {
  if (!rule.lastRun || occurrence > rule.lastRun) rule.lastRun = occurrence;
}

/** Versement (montant > 0) ou retrait (montant < 0) sur un objectif d'épargne. */
export function moveToGoal(state, goal, amount, date, record = true) {
  if (amount > 0) {
    goal.saved += amount;
    if (record) addTransaction(state, { type: "expense", amount, category: "epargne", date, note: `Épargne : ${goal.name}`, goalId: goal.id });
  } else {
    const out = Math.min(goal.saved, -amount);
    goal.saved -= out;
    if (record && out > 0) addTransaction(state, { type: "income", amount: out, category: "autre_revenu", date, note: `Retrait : ${goal.name}`, goalId: goal.id });
  }
}

/** Opération Mobile Money : envoi (dépense + frais), retrait ou dépôt (frais seuls). */
export function mobileMoney(state, { operation, operator, operatorLabel, amount, fee, category, note, date }) {
  const created = [];
  if (operation === "send") {
    created.push(addTransaction(state, { type: "expense", amount, category, date, note: note || `Envoi ${operatorLabel}`, method: operator }));
  }
  if (fee > 0) {
    const what = { send: "envoi", withdraw: "retrait", deposit: "dépôt" }[operation];
    created.push(addTransaction(state, { type: "expense", amount: fee, category: "frais_momo", date, note: `Frais ${what} ${operatorLabel}`, method: operator }));
  }
  return created;
}

// ---------- Tontine ----------

/** Coche / décoche la cotisation d'un membre pour un tour. */
export function toggleTontinePaid(state, t, round, memberIndex, { record = true, date } = {}) {
  t.paid ||= {};
  const list = new Set(t.paid[round] || []);
  const wasPaid = list.has(memberIndex);
  wasPaid ? list.delete(memberIndex) : list.add(memberIndex);
  t.paid[round] = [...list].sort((a, b) => a - b);
  // Ma propre cotisation est une dépense réelle.
  if (memberIndex === t.myIndex && record) {
    if (!wasPaid) {
      addTransaction(state, { type: "expense", amount: t.amount, category: "tontine", date, note: `Cotisation ${t.name} (tour ${round + 1})`, tontineId: t.id, round });
    } else {
      state.transactions = state.transactions.filter((x) => !(x.tontineId === t.id && x.round === round && x.category === "tontine"));
    }
  }
  return !wasPaid;
}

export function receiveTontine(state, t, date) {
  t.received = true;
  addTransaction(state, { type: "income", amount: calc.tontinePot(t), category: "tontine_recue", date, note: `Cagnotte ${t.name}`, tontineId: t.id });
}

// ---------- Dettes ----------

export function addDebt(state, debt, record) {
  const d = { id: uid(), repayments: [], ...debt };
  state.debts.push(d);
  if (record) {
    addTransaction(state, d.direction === "lent"
      ? { type: "expense", amount: d.amount, category: "pret_accorde", date: d.date, note: `Prêt à ${d.person}`, debtId: d.id }
      : { type: "income", amount: d.amount, category: "emprunt_recu", date: d.date, note: `Emprunt à ${d.person}`, debtId: d.id });
  }
  return d;
}

export function addRepayment(state, debt, amount, date, record) {
  debt.repayments.push({ id: uid(), amount, date });
  if (record) {
    addTransaction(state, debt.direction === "lent"
      ? { type: "income", amount, category: "remboursement_recu", date, note: `Remboursement de ${debt.person}`, debtId: debt.id }
      : { type: "expense", amount, category: "remboursement_dette", date, note: `Remboursement à ${debt.person}`, debtId: debt.id });
  }
}
