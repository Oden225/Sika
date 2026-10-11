import { test } from "node:test";
import assert from "node:assert/strict";
import * as calc from "../js/calc.js";

const tx = [
  { type: "income", amount: 300000, category: "Salaire", date: "2026-10-01" },
  { type: "expense", amount: 80000, category: "Logement", date: "2026-10-03" },
  { type: "expense", amount: 45000, category: "Alimentation", date: "2026-10-10" },
  { type: "expense", amount: 15000, category: "Alimentation", date: "2026-10-20" },
  { type: "expense", amount: 20000, category: "Transport", date: "2026-09-28" },
];

test("monthKey", () => {
  assert.equal(calc.monthKey("2026-01-31"), "2026-01");
  assert.equal(calc.monthKey(new Date(2026, 11, 5)), "2026-12");
});

test("monthsBetween compte les mois entiers, minimum 1", () => {
  assert.equal(calc.monthsBetween("2026-10-11", "2027-10-11"), 12);
  assert.equal(calc.monthsBetween("2026-10-11", "2027-10-10"), 11);
  assert.equal(calc.monthsBetween("2026-10-11", "2026-10-20"), 1);
  assert.equal(calc.monthsBetween("2026-10-11", "2025-01-01"), 1);
});

test("summarize et filterByMonth", () => {
  const oct = calc.filterByMonth(tx, "2026-10");
  assert.equal(oct.length, 4);
  assert.deepEqual(calc.summarize(oct), { income: 300000, expense: 140000, balance: 160000 });
});

test("expensesByCategory trie par montant décroissant", () => {
  const cats = calc.expensesByCategory(calc.filterByMonth(tx, "2026-10"));
  assert.deepEqual(cats, [
    { category: "Logement", amount: 80000 },
    { category: "Alimentation", amount: 60000 },
  ]);
});

test("savingsRate", () => {
  assert.equal(calc.savingsRate(300000, 240000), 0.2);
  assert.equal(calc.savingsRate(0, 1000), 0);
});

test("monthlyContribution sans intérêts", () => {
  assert.equal(calc.monthlyContribution(1200000, 0, 12), 100000);
  assert.equal(calc.monthlyContribution(1200000, 600000, 12), 50000);
  assert.equal(calc.monthlyContribution(1000, 2000, 12), 0);
});

test("monthlyContribution avec intérêts atteint exactement la cible", () => {
  const target = 1000000, saved = 100000, months = 24, rate = 0.06;
  const pmt = calc.monthlyContribution(target, saved, months, rate);
  const pts = calc.projectSavings(saved, pmt, rate, 2);
  assert.ok(Math.abs(pts.at(-1).balance - target) < 0.01);
  assert.ok(pmt < (target - saved) / months);
});

test("projectSavings", () => {
  const pts = calc.projectSavings(0, 10000, 0, 2);
  assert.equal(pts.length, 3);
  assert.equal(pts[2].balance, 240000);
  assert.equal(pts[2].contributed, 240000);
});

test("budgetRule et goalProgress", () => {
  assert.deepEqual(calc.budgetRule(100), { needs: 50, wants: 30, savings: 20 });
  assert.equal(calc.goalProgress({ target: 200, saved: 50 }), 0.25);
  assert.equal(calc.goalProgress({ target: 200, saved: 500 }), 1);
});

test("nthOccurrence : fin de mois, hebdomadaire et annuel", () => {
  assert.equal(calc.nthOccurrence("2026-01-31", "monthly", 1), "2026-02-28");
  assert.equal(calc.nthOccurrence("2026-01-31", "monthly", 2), "2026-03-31");
  assert.equal(calc.nthOccurrence("2026-11-15", "monthly", 3), "2027-02-15");
  assert.equal(calc.nthOccurrence("2026-12-28", "weekly", 1), "2027-01-04");
  assert.equal(calc.nthOccurrence("2028-02-29", "yearly", 1), "2029-02-28");
});

test("occurrencesBetween respecte after, until et end", () => {
  const rule = { start: "2026-07-25", frequency: "monthly" };
  assert.deepEqual(calc.occurrencesBetween(rule, null, "2026-10-11"), ["2026-07-25", "2026-08-25", "2026-09-25"]);
  assert.deepEqual(calc.occurrencesBetween(rule, "2026-08-25", "2026-10-25"), ["2026-09-25", "2026-10-25"]);
  assert.deepEqual(calc.occurrencesBetween({ ...rule, end: "2026-08-31" }, null, "2026-12-31"), ["2026-07-25", "2026-08-25"]);
  assert.deepEqual(calc.occurrencesBetween({ start: "2026-11-01", frequency: "monthly" }, null, "2026-10-11"), []);
});

test("nextOccurrence", () => {
  const rule = { start: "2026-01-05", frequency: "monthly" };
  assert.equal(calc.nextOccurrence(rule, "2026-10-11"), "2026-11-05");
  assert.equal(calc.nextOccurrence({ ...rule, end: "2026-10-31" }, "2026-10-11"), null);
});

test("generateRecurring rattrape les échéances sans doublon", () => {
  const rules = [
    { id: "r1", type: "income", amount: 300000, category: "Salaire", note: "Salaire", start: "2026-08-28", frequency: "monthly" },
    { id: "r2", type: "expense", amount: 80000, category: "Logement", note: "Loyer", start: "2026-10-05", frequency: "monthly", paused: true },
  ];
  const first = calc.generateRecurring(rules, "2026-10-11");
  assert.deepEqual(first.transactions.map((t) => t.date), ["2026-08-28", "2026-09-28"]);
  assert.equal(first.transactions[0].recurringId, "r1");
  assert.equal(first.rules[0].lastRun, "2026-09-28");
  assert.equal(first.rules[1], rules[1]);

  const again = calc.generateRecurring(first.rules, "2026-10-27");
  assert.equal(again.transactions.length, 0);
  const later = calc.generateRecurring(first.rules, "2026-10-28");
  assert.deepEqual(later.transactions.map((t) => t.date), ["2026-10-28"]);
});

test("upcomingThisMonth", () => {
  const rules = [
    { id: "a", start: "2026-01-28", frequency: "monthly", amount: 1 },
    { id: "b", start: "2026-01-05", frequency: "monthly", amount: 1 },
    { id: "c", start: "2026-10-12", frequency: "weekly", amount: 1 },
  ];
  assert.deepEqual(
    calc.upcomingThisMonth(rules, "2026-10-11").map((r) => `${r.rule.id}:${r.date}`),
    ["c:2026-10-12", "c:2026-10-19", "c:2026-10-26", "a:2026-10-28"],
  );
});

test("fréquences bimestrielle et trimestrielle", () => {
  assert.equal(calc.nthOccurrence("2026-11-15", "bimonthly", 1), "2027-01-15");
  assert.equal(calc.nthOccurrence("2026-10-05", "quarterly", 2), "2027-04-05");
});

test("règles à confirmer : pas d'ajout automatique, échéances en attente", () => {
  const rule = { id: "cie", type: "expense", amount: 15000, category: "electricite", note: "CIE", start: "2026-09-15", frequency: "monthly", auto: false, lastRun: null };
  assert.equal(calc.generateRecurring([rule], "2026-10-20").transactions.length, 0);
  assert.deepEqual(calc.pendingOccurrences(rule, "2026-10-20"), ["2026-09-15", "2026-10-15"]);
  assert.deepEqual(calc.pendingOccurrences({ ...rule, lastRun: "2026-09-15" }, "2026-10-20"), ["2026-10-15"]);
});

test("upcomingPayments : retards à confirmer, échéance du jour, automatiques", () => {
  const rules = [
    { id: "cie", amount: 1, start: "2026-09-15", frequency: "monthly", auto: false, lastRun: "2026-09-15" },
    { id: "loyer", amount: 1, start: "2026-01-11", frequency: "monthly", auto: false, lastRun: "2026-09-11" },
    { id: "sal", amount: 1, start: "2026-01-31", frequency: "monthly", lastRun: "2026-09-30" },
    { id: "off", amount: 1, start: "2026-01-12", frequency: "monthly", paused: true },
  ];
  const items = calc.upcomingPayments(rules, "2026-10-20", 15).map((i) => `${i.rule.id}:${i.date}:${i.overdue ? "retard" : i.daysLeft}`);
  assert.deepEqual(items, ["loyer:2026-10-11:retard", "cie:2026-10-15:retard", "sal:2026-10-31:11"]);
  const today = calc.upcomingPayments([{ id: "x", amount: 1, start: "2026-10-20", frequency: "monthly", auto: false }], "2026-10-20", 5);
  assert.deepEqual(today.map((i) => [i.date, i.daysLeft, i.overdue]), [["2026-10-20", 0, false]]);
});

test("averageMonthlyIncome ignore les mois sans revenu", () => {
  const tx = [
    { type: "income", amount: 200000, date: "2026-07-10" },
    { type: "income", amount: 100000, date: "2026-09-02" },
    { type: "income", amount: 999999, date: "2026-10-01" },
  ];
  assert.equal(calc.averageMonthlyIncome(tx, "2026-10", 3), 150000);
  assert.equal(calc.averageMonthlyIncome([], "2026-10"), 0);
});

test("suggestedSaving et mobileMoneyFee", () => {
  assert.equal(calc.suggestedSaving(47000, 10), 4500);
  assert.equal(calc.suggestedSaving(48000, 10), 5000);
  assert.equal(calc.mobileMoneyFee(50000, { rate: 1 }), 500);
  assert.equal(calc.mobileMoneyFee(1000000, { rate: 1, cap: 4500 }), 4500);
  assert.equal(calc.mobileMoneyFee(20000, { rate: 0 }), 0);
});

test("dettes", () => {
  const debts = [
    { direction: "lent", amount: 50000, repayments: [{ amount: 20000 }] },
    { direction: "borrowed", amount: 30000, repayments: [] },
    { direction: "lent", amount: 10000, repayments: [{ amount: 15000 }] },
  ];
  assert.equal(calc.debtRemaining(debts[0]), 30000);
  assert.equal(calc.debtRemaining(debts[2]), 0);
  assert.deepEqual(calc.debtTotals(debts), { owedToMe: 30000, iOwe: 30000 });
});

test("tontine : cagnotte, calendrier, tour en cours, mon tour", () => {
  const t = { amount: 20000, frequency: "monthly", start: "2026-08-05", members: ["Awa", "Moi", "Koffi", "Adjoua"], myIndex: 1, paid: { 0: [0, 1, 2, 3] } };
  assert.equal(calc.tontinePot(t), 80000);
  assert.deepEqual(calc.tontineSchedule(t).map((r) => r.date), ["2026-08-05", "2026-09-05", "2026-10-05", "2026-11-05"]);
  assert.equal(calc.tontineCurrentRound(t, "2026-10-11").round.index, 3);
  assert.equal(calc.tontineCurrentRound(t, "2026-10-05").round.index, 2);
  assert.equal(calc.tontineCurrentRound(t, "2027-01-01").round.index, 3);
  assert.equal(calc.tontineCurrentRound(t, "2026-07-01").round.index, 0);
  assert.equal(calc.tontineMyRound(t).date, "2026-09-05");
  assert.equal(calc.tontinePaidCount(t, 0), 4);
});

test("reminders : facture proche, dette due, cotisation tontine", () => {
  const state = {
    recurring: [
      { id: "cie", note: "CIE", amount: 15000, type: "expense", start: "2026-10-12", frequency: "monthly", auto: false, remindDays: 2 },
      { id: "loin", note: "Loin", amount: 1, type: "expense", start: "2026-10-25", frequency: "monthly", auto: false, remindDays: 2 },
      { id: "auto", note: "Auto", amount: 1, type: "expense", start: "2026-10-12", frequency: "monthly" },
    ],
    debts: [{ id: "d", person: "Yao", direction: "lent", amount: 10000, due: "2026-10-12", repayments: [] }],
    tontines: [{ id: "t", name: "Bureau", amount: 20000, frequency: "monthly", start: "2026-10-12", members: ["Moi", "A"], myIndex: 0, paid: {} }],
  };
  const r = calc.reminders(state, "2026-10-11");
  assert.deepEqual(r.map((i) => `${i.kind}:${i.id}:${i.daysLeft}`).sort(), ["bill:cie:1", "debt:d:1", "tontine:t:1"]);
});
